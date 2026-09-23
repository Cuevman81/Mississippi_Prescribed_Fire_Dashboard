import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const API_KEY = process.env.AIRNOW_API_KEY;
const MS_BBOX = '-91.655,30.174,-88.098,34.996';
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 40); // dashboard fires 3 AQ calls per search
  if (limited) return limited;

  const type = request.nextUrl.searchParams.get('type'); // current | forecast | monitors
  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');
  let latNum = NaN;
  let lonNum = NaN;
  if (type !== 'current' && type !== 'forecast' && type !== 'monitors') {
    return NextResponse.json({ error: 'Invalid type. Use current, forecast, or monitors' }, { status: 400 });
  }

  if (type === 'current' || type === 'forecast') {
    if (!lat || !lon) {
      return NextResponse.json({ error: 'Missing lat/lon' }, { status: 400 });
    }
    latNum = parseFloat(lat);
    lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }
  }
  if (!API_KEY) {
    return NextResponse.json({ error: 'AirNow API key not configured' }, { status: 500 });
  }

  try {
    switch (type) {
      case 'current':
        return await getCurrentAQI(latNum, lonNum);
      case 'forecast':
        return await getForecastAQI(latNum, lonNum);
      case 'monitors':
        return await getStateMonitors();
      default:
        return NextResponse.json({ error: 'Invalid type. Use current, forecast, or monitors' }, { status: 400 });
    }
  } catch (err) {
    console.error('AirNow API error:', err);
    return NextResponse.json({ error: 'Air quality service unavailable' }, { status: 500 });
  }
}

// AirNow retired /aq/observation/latLong/current/ and /aq/forecast/latLong/
// on 2026-09-30 (docs.airnowapi.org/webservices, "Web Services that will be
// retired in the fall of 2026"). The replacements RENAME fields, not just
// re-case them, so every field is read under its new name first and its old
// name second:
//   observations: AQI -> nowcastAQI, Category {Number, Name} -> aqiCategoryName
//     (no number), ReportingArea -> reportingAreaName, HourObserved (number)
//     -> hourObserved ("21:00"); StateCode/Latitude/Longitude are gone
//   forecasts: DateForecast -> dateValid, Category -> categoryNumber +
//     categoryName; Latitude/Longitude are gone
function airNowUrl(path: string, lat: number, lon: number): string {
  const params = new URLSearchParams({
    format: 'application/json',
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    distance: '25',
    API_KEY: API_KEY!,
  });
  return `https://www.airnowapi.org${path}?${params}`;
}

async function getCurrentAQI(lat: number, lon: number) {
  const res = await fetch(airNowUrl('/aq/observation/current/ziplatlong/', lat, lon), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Current AQI unavailable' }, { status: res.status });
  }

  const raw = await res.json();

  // Normalize to our camelCase AQIObservation interface
  const data = (raw as Record<string, unknown>[])
    .map((obs: Record<string, unknown>) => ({
      dateObserved: String(pick(obs, 'dateObserved', 'DateObserved') ?? '').trim(),
      hourObserved: toHour(pick(obs, 'hourObserved', 'HourObserved')),
      localTimeZone: pick(obs, 'localTimeZone', 'LocalTimeZone'),
      reportingArea: pick(obs, 'reportingAreaName', 'ReportingArea', 'reportingArea'),
      stateCode: pick(obs, 'StateCode', 'stateCode'),
      latitude: pick(obs, 'Latitude', 'latitude'),
      longitude: pick(obs, 'Longitude', 'longitude'),
      parameterName: pick(obs, 'parameterName', 'ParameterName'),
      aqi: toAQI(pick(obs, 'nowcastAQI', 'AQI', 'aqi')),
      category: normalizeCategoryField(pick(obs, 'Category', 'category', 'aqiCategoryName')),
    }))
    // A reading with no AQI is dropped. Defaulting it to 0 would show "Good"
    // and hide the "avoid burning" banner.
    .filter((o) => o.aqi !== null && o.aqi >= 0);

  return NextResponse.json(data);
}

async function getForecastAQI(lat: number, lon: number) {
  const res = await fetch(airNowUrl('/aq/forecast/current/', lat, lon), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'AQI forecast unavailable' }, { status: res.status });
  }

  const raw = await res.json();

  // Normalize to our camelCase AQIForecast interface. aqi -1 is AirNow's
  // "category forecast only, no number".
  const data = (raw as Record<string, unknown>[]).map((f: Record<string, unknown>) => ({
    dateIssue: String(pick(f, 'dateIssue', 'DateIssue') ?? '').trim(),
    // Trimmed because the page matches it against today's date with ===
    dateForecast: String(pick(f, 'dateValid', 'DateForecast', 'dateForecast') ?? '').trim(),
    reportingArea: pick(f, 'reportingArea', 'ReportingArea'),
    stateCode: pick(f, 'stateCode', 'StateCode'),
    latitude: pick(f, 'Latitude', 'latitude'),
    longitude: pick(f, 'Longitude', 'longitude'),
    parameterName: pick(f, 'parameterName', 'ParameterName'),
    aqi: toAQI(pick(f, 'aqi', 'AQI')) ?? -1,
    category: normalizeCategoryField(
      pick(f, 'Category', 'category') ??
        (f.categoryName !== undefined ? { number: f.categoryNumber, name: f.categoryName } : undefined)
    ),
    actionDay: pick(f, 'actionDay', 'ActionDay') ?? false,
    discussion: pick(f, 'discussion', 'Discussion') ?? '',
  }));

  return NextResponse.json(data);
}

async function getStateMonitors() {
  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 3600000);

  const formatDate = (d: Date) =>
    d.toISOString().replace(/T.*/, 'T') +
    String(d.getUTCHours()).padStart(2, '0');

  const params = new URLSearchParams({
    startDate: formatDate(startDate),
    endDate: formatDate(now),
    parameters: 'PM25,OZONE',
    BBOX: MS_BBOX,
    dataType: 'B',
    format: 'application/json',
    verbose: '1',
    nowcastonly: '0',
    includerawconcentrations: '0',
    API_KEY: API_KEY!,
  });

  const res = await fetch(`https://www.airnowapi.org/aq/data/?${params}`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Monitor data unavailable' }, { status: res.status });
  }

  const data = await res.json();

  // Deduplicate by site — keep latest reading per site+parameter
  const seen = new Map<string, Record<string, unknown>>();
  for (const entry of data) {
    const key = `${entry.Latitude}_${entry.Longitude}_${entry.Parameter}`;
    const existing = seen.get(key);
    if (!existing || entry.UTC > (existing.UTC as string)) {
      seen.set(key, entry);
    }
  }

  const monitors = Array.from(seen.values()).map((m) => ({
    latitude: m.Latitude,
    longitude: m.Longitude,
    utc: m.UTC,
    parameter: m.Parameter,
    aqi: m.AQI,
    category: m.Category,
    siteName: m.SiteName || 'Unknown',
  }));

  return NextResponse.json(monitors);
}

/** First field that is present (not undefined/null), in the order given. */
function pick(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
}

/** AQI as a number, or null when missing or not numeric (never 0 by default). */
function toAQI(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Hour of day from the old numeric HourObserved or the new "21:00" string. */
function toHour(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : null;
}

// AirNow's category numbers for the six EPA AQI categories (the same numbers
// the old Category.Number and the new forecast categoryNumber carry). The new
// observation service sends only the name, so the number is derived from it.
const AQI_CATEGORY_NUMBER: Record<string, number> = {
  'Good': 1,
  'Moderate': 2,
  'Unhealthy for Sensitive Groups': 3,
  'Unhealthy': 4,
  'Very Unhealthy': 5,
  'Hazardous': 6,
};

/**
 * Normalize the AirNow category to our AQICategory { number, name }.
 * Handles: the old { Number, Name } object, an already-normalized
 * { number, name }, the new bare category-name string, or missing values.
 */
function normalizeCategoryField(cat: unknown): { number: number; name: string } {
  if (typeof cat === 'string' && cat.trim() !== '') {
    const name = cat.trim();
    return { number: AQI_CATEGORY_NUMBER[name] ?? 0, name };
  }
  if (!cat || typeof cat !== 'object') {
    return { number: 0, name: 'Unknown' };
  }

  const c = cat as Record<string, unknown>;
  const name = String(c.Name ?? c.name ?? 'Unknown').trim();
  const number = Number(c.Number ?? c.number);

  return {
    number: Number.isFinite(number) && number > 0 ? number : AQI_CATEGORY_NUMBER[name] ?? 0,
    name,
  };
}
