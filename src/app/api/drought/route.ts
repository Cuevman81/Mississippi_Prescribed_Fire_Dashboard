import { NextResponse } from 'next/server';
import shp from 'shpjs';

// Cache drought data for 6 hours (updated weekly by USDM)
let cachedData: { data: unknown; timestamp: number } | null = null;
const CACHE_DURATION = 6 * 60 * 60 * 1000;

export async function GET() {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return NextResponse.json(cachedData.data);
  }

  try {
    const url = 'https://droughtmonitor.unl.edu/data/shapefiles_m/USDM_current_M.zip';
    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json({ error: 'Drought data unavailable' }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const geojson = await shp(buffer);

    let featureCollection: GeoJSON.FeatureCollection;
    if (Array.isArray(geojson)) {
      featureCollection = geojson[0] as GeoJSON.FeatureCollection;
    } else {
      featureCollection = geojson as GeoJSON.FeatureCollection;
    }

    // Add drought category labels
    const processed = {
      type: 'FeatureCollection',
      features: featureCollection.features.map((f) => {
        const dm = f.properties?.DM ?? f.properties?.dm ?? 0;
        const labels: Record<number, string> = {
          0: 'D0 - Abnormally Dry',
          1: 'D1 - Moderate Drought',
          2: 'D2 - Severe Drought',
          3: 'D3 - Extreme Drought',
          4: 'D4 - Exceptional Drought',
        };
        return {
          ...f,
          properties: {
            ...f.properties,
            dm: dm,
            label: labels[dm] || `D${dm}`,
          },
        };
      }),
    };

    const dataWithMeta = {
      ...processed,
      lastUpdated: new Date().toISOString(),
    };

    cachedData = { data: dataWithMeta, timestamp: Date.now() };
    return NextResponse.json(dataWithMeta);
  } catch (err) {
    console.error('Drought API error:', err);
    return NextResponse.json({ error: 'Drought data service unavailable' }, { status: 500 });
  }
}
