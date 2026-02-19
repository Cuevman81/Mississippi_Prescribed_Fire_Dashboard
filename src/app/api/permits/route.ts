import { NextResponse } from 'next/server';

// Cache permit data for 5 minutes
let cachedData: { data: unknown; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000;

export async function GET() {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData.data);
  }

  try {
    // Step 1: Get the app data to find the webmap ID
    const appId = '14bb6f3f82b14f8e9df45eff193b809a';
    const appRes = await fetch(
      `https://mfcgis.maps.arcgis.com/sharing/rest/content/items/${appId}/data?f=json`
    );

    if (!appRes.ok) {
      return NextResponse.json({ error: 'MFC data unavailable' }, { status: appRes.status });
    }

    const appData = await appRes.json();
    const webmapId = appData.values?.webmap;

    if (!webmapId) {
      return NextResponse.json({ error: 'Could not find MFC webmap' }, { status: 500 });
    }

    // Step 2: Get webmap data to find the layer URL
    const mapRes = await fetch(
      `https://mfcgis.maps.arcgis.com/sharing/rest/content/items/${webmapId}/data?f=json`
    );

    if (!mapRes.ok) {
      return NextResponse.json({ error: 'MFC webmap data unavailable' }, { status: mapRes.status });
    }

    const mapData = await mapRes.json();
    const targetLayer = mapData.operationalLayers?.find(
      (l: { title: string }) => l.title === 'MFC Burn Permit Application Records'
    );

    if (!targetLayer?.url) {
      return NextResponse.json({ error: 'MFC layer not found' }, { status: 500 });
    }

    // Step 3: Paginated data download (all records)
    const allRecords = await pullArcGISData(targetLayer.url);

    // Step 4: Process records
    const permits = allRecords.map((attrs: Record<string, unknown>) => {
      const windSpeed = parseFloat(String(attrs.wind_speed || 0));
      const mixingHeight = parseFloat(String(attrs.mixing_height || 0));
      const ventilationIndex = mixingHeight * windSpeed;
      const windDir = String(attrs.wind_direction || '');

      // Parse permit date
      let permitDate = '';
      let year = 0;
      const dateStr = String(attrs.permit_date || '');
      if (dateStr) {
        // Try parsing MM/DD/YYYY format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [m, d, y] = parts;
          permitDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          year = parseInt(y);
        }
      }

      // Wind direction to meteorological degrees (N=0, clockwise)
      const windDegMap: Record<string, number> = {
        N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
      };

      let dispersionQuality: string;
      if (ventilationIndex < 20000) dispersionQuality = 'Poor (Trapping)';
      else if (ventilationIndex < 40000) dispersionQuality = 'Fair';
      else dispersionQuality = 'Good (Clearing)';

      return {
        objectId: attrs.objectid,
        permitDate,
        county: toTitleCase(String(attrs.county || '')),
        windDirection: windDir,
        windSpeed,
        mixingHeight,
        burnAcresEstimate: parseFloat(String(attrs.burn_acres_estimate || 0)),
        longitude: parseFloat(String(attrs.longitude_dd || 0)),
        latitude: parseFloat(String(attrs.latitude_dd || 0)),
        ventilationIndex: Math.round(ventilationIndex),
        dispersionQuality,
        windDeg: windDegMap[windDir.toUpperCase()] ?? null,
        year,
        burnPurpose: attrs.burn_purpose ? String(attrs.burn_purpose) : undefined,
        burnType: attrs.burn_type ? String(attrs.burn_type) : undefined,
        certBurnManager: attrs.cert_burn_manager ? String(attrs.cert_burn_manager) : undefined,
      };
    }).filter((p: { year: number }) => p.year > 0);

    cachedData = { data: permits, timestamp: Date.now() };
    return NextResponse.json(permits);
  } catch (err) {
    console.error('Permits API error:', err);
    return NextResponse.json({ error: 'Permit data service unavailable' }, { status: 500 });
  }
}

async function pullArcGISData(baseUrl: string): Promise<Record<string, unknown>[]> {
  const allFeatures: Record<string, unknown>[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      f: 'json',
      resultOffset: String(offset),
      resultRecordCount: String(batchSize),
      orderByFields: 'objectid ASC',
    });

    const res = await fetch(`${baseUrl}/query?${params}`);
    if (!res.ok) break;

    const data = await res.json();
    const features = data.features;

    if (!features || features.length === 0) break;

    for (const f of features) {
      allFeatures.push(f.attributes);
    }

    if (features.length < batchSize) break;
    offset += batchSize;
  }

  return allFeatures;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
