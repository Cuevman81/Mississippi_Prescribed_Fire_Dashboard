import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import {
  MFC_BAN_CSV,
  MFC_BURN_BAN_PAGE,
  MFC_COUNTY_LAYER,
  buildBurnBanReport,
  parseBanCsv,
  parseCountyLayer,
  type BurnBanResponse,
  type BurnBanResult,
} from '@/lib/burn-bans';

// Statewide data goes through Next's shared data cache; MFC refreshes it hourly
const DATA_REVALIDATE = 300;
// County boundaries don't move, so a point's county can be cached for a day
const POINT_REVALIDATE = 24 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 10_000;

const OK_HEADERS = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
// A failed check must not be cached as if it were an answer
const FAIL_HEADERS = { 'Cache-Control': 'no-store' };

// Only the county name and ban flags: this layer has no personal data, and
// the permit layer (which does) is never queried here
const LIST_PARAMS = new URLSearchParams({
  where: '1=1',
  outFields: 'NAME,county_name_csv_match,hasCountyBan,hasMFCBan',
  returnGeometry: 'true',
  outSR: '4326',
  // ~500 m generalization keeps the statewide layer near 40 KB
  maxAllowableOffset: '0.005',
  geometryPrecision: '4',
  f: 'geojson',
});

async function getJson(url: string, revalidate: number): Promise<unknown> {
  const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  const data = await res.json();
  // ArcGIS reports errors as HTTP 200 with an error body
  if (data && typeof data === 'object' && 'error' in data) throw new Error('ArcGIS error response');
  return data;
}

async function getText(url: string, revalidate: number): Promise<string> {
  const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.text();
}

/** The county containing a point: its name, null if outside Mississippi */
async function countyAt(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    geometry: `${lon.toFixed(4)},${lat.toFixed(4)}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'NAME',
    returnGeometry: 'false',
    f: 'json',
  });
  const data = (await getJson(`${MFC_COUNTY_LAYER}/query?${params}`, POINT_REVALIDATE)) as {
    features?: Array<{ attributes?: { NAME?: string } }>;
  };
  if (!Array.isArray(data.features)) throw new Error('county lookup: no features');
  return data.features[0]?.attributes?.NAME?.trim() || null;
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 30);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const wantGeometry = sp.get('geometry') === '1';
  const lat = sp.get('lat');
  const lon = sp.get('lon');
  let point: { lat: number; lon: number } | null = null;
  if (lat !== null || lon !== null) {
    const latNum = parseFloat(lat ?? '');
    const lonNum = parseFloat(lon ?? '');
    if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }
    point = { lat: latNum, lon: lonNum };
  }

  const [layerRes, metaRes, csvRes, pointRes] = await Promise.allSettled([
    getJson(`${MFC_COUNTY_LAYER}/query?${LIST_PARAMS}`, DATA_REVALIDATE),
    getJson(`${MFC_COUNTY_LAYER}?f=json`, DATA_REVALIDATE),
    getText(MFC_BAN_CSV, DATA_REVALIDATE),
    point ? countyAt(point.lat, point.lon) : Promise.resolve(null),
  ]);

  // The county layer is the ban list itself: without it there is no answer
  let counties;
  try {
    if (layerRes.status === 'rejected') throw layerRes.reason;
    counties = parseCountyLayer(layerRes.value);
  } catch (err) {
    console.error('Burn ban source unavailable:', err);
    const body: BurnBanResult = {
      available: false,
      reason: 'Burn ban status unavailable — the Mississippi Forestry Commission data could not be reached',
      source: MFC_BURN_BAN_PAGE,
    };
    return NextResponse.json(body, { status: 502, headers: FAIL_HEADERS });
  }

  // Exemptions are secondary: without them each ban shows "exemptions unknown"
  let csv = null;
  if (csvRes.status === 'fulfilled') {
    try {
      csv = parseBanCsv(csvRes.value);
    } catch (err) {
      console.error('Burn ban exemptions unreadable:', err);
    }
  }

  const editDate =
    metaRes.status === 'fulfilled'
      ? (metaRes.value as { editingInfo?: { dataLastEditDate?: number } }).editingInfo?.dataLastEditDate
      : undefined;

  const report = buildBurnBanReport({
    counties,
    csv,
    asOf: typeof editDate === 'number' ? editDate : null,
  });

  const body: BurnBanResponse = { ...report };
  if (point) {
    body.location =
      pointRes.status === 'fulfilled'
        ? { county: pointRes.value, lookupFailed: false }
        : { county: null, lookupFailed: true };
  }
  if (wantGeometry) {
    const features = (layerRes as PromiseFulfilledResult<{ features: GeoJSON.Feature[] }>).value.features;
    body.geojson = {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { name: String(f.properties?.NAME ?? '').trim() },
      })),
    };
  }

  return NextResponse.json(body, { headers: point && pointRes.status === 'rejected' ? FAIL_HEADERS : OK_HEADERS });
}
