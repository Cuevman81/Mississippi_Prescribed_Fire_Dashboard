import { NextRequest, NextResponse } from 'next/server';
import shp from 'shpjs';
import { rateLimit } from '@/lib/rate-limit';

// USDM updates weekly (Thursdays); cache upstream fetch in Next's shared
// data cache and CDN-cache the route response for 6 hours.
const REVALIDATE_SECONDS = 6 * 60 * 60;
const CACHE_HEADERS = {
  'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
};

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 10);
  if (limited) return limited;

  try {
    const url = 'https://droughtmonitor.unl.edu/data/shapefiles_m/USDM_current_M.zip';
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });

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

    return NextResponse.json(dataWithMeta, { headers: CACHE_HEADERS });
  } catch (err) {
    console.error('Drought API error:', err);
    return NextResponse.json({ error: 'Drought data service unavailable' }, { status: 500 });
  }
}
