import { NextRequest, NextResponse } from 'next/server';
import shp from 'shpjs';
import { rateLimit } from '@/lib/rate-limit';

// HMS covers the whole hemisphere (~80k fire points on a summer day),
// which froze the browser when rendered. The client picks a viewing
// region; we filter server-side. Smoke polygons are kept when they
// REACH into the region even if the source fire is far away
// (e.g., Canadian wildfire smoke drifting over Mississippi).
import { HMS_REGIONS, DEFAULT_HMS_REGION, type HMSRegion } from '@/lib/constants';

// Cap what we return so even fire-season CONUS stays renderable;
// highest-intensity detections (FRP) win the cut
const MAX_FIRE_POINTS = 15000;

function featureOverlapsRegion(geometry: GeoJSON.Geometry, region: HMSRegion): boolean {
  const polygons: GeoJSON.Position[][][] =
    geometry.type === 'Polygon'
      ? [(geometry as GeoJSON.Polygon).coordinates]
      : geometry.type === 'MultiPolygon'
        ? (geometry as GeoJSON.MultiPolygon).coordinates
        : [];

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const poly of polygons) {
    for (const ring of poly) {
      for (const [lon, lat] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
      }
    }
  }

  return (
    minLat <= region.maxLat &&
    maxLat >= region.minLat &&
    minLon <= region.maxLon &&
    maxLon >= region.minLon
  );
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 20); // allows browsing back through dates
  if (limited) return limited;

  const regionParam = request.nextUrl.searchParams.get('region') || DEFAULT_HMS_REGION;
  const region = HMS_REGIONS[regionParam];
  if (!region) {
    return NextResponse.json(
      { error: `Invalid region. Use one of: ${Object.keys(HMS_REGIONS).join(', ')}` },
      { status: 400 }
    );
  }

  const dateParam = request.nextUrl.searchParams.get('date');
  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
  }
  const date = dateParam ? new Date(dateParam) : new Date();
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const fireUrl = `https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Fire_Points/Shapefile/${year}/${month}/hms_fire${dateStr}.zip`;
  const smokeUrl = `https://satepsanone.nesdis.noaa.gov/pub/FIRE/web/HMS/Smoke_Polygons/Shapefile/${year}/${month}/hms_smoke${dateStr}.zip`;

  try {
    const [fires, smoke] = await Promise.allSettled([
      fetchAndParseShapefile(fireUrl),
      fetchAndParseShapefile(smokeUrl),
    ]);

    // Process fire points — regional filter cuts ~80k hemisphere-wide
    // points down to a renderable few thousand
    let firePoints: Array<{ lat: number; lon: number; frp: number } & Record<string, unknown>> = [];
    let totalFires = 0;
    if (fires.status === 'fulfilled' && fires.value) {
      const fc = fires.value as GeoJSON.FeatureCollection;
      firePoints = (fc.features || [])
        .map((f) => ({
          lat: (f.properties?.Lat || (f.geometry as GeoJSON.Point)?.coordinates?.[1]) as number,
          lon: (f.properties?.Lon || (f.geometry as GeoJSON.Point)?.coordinates?.[0]) as number,
          satellite: f.properties?.Satellite || f.properties?.satellite || '',
          method: f.properties?.Method || f.properties?.method || '',
          frp: Number(f.properties?.FRP || f.properties?.frp || 0),
          time: f.properties?.Time || f.properties?.time || '',
        }))
        .filter(
          (p) =>
            typeof p.lat === 'number' &&
            typeof p.lon === 'number' &&
            p.lat >= region.minLat &&
            p.lat <= region.maxLat &&
            p.lon >= region.minLon &&
            p.lon <= region.maxLon
        );

      totalFires = firePoints.length;
      if (firePoints.length > MAX_FIRE_POINTS) {
        // Keep the most intense detections when a big region is in
        // heavy fire season
        firePoints.sort((a, b) => b.frp - a.frp);
        firePoints = firePoints.slice(0, MAX_FIRE_POINTS);
      }
    }

    // Process smoke polygons — add density classification, keep polygons
    // that overlap the region
    let smokeGeoJSON: GeoJSON.FeatureCollection | null = null;
    if (smoke.status === 'fulfilled' && smoke.value) {
      const fc = smoke.value as GeoJSON.FeatureCollection;
      smokeGeoJSON = {
        type: 'FeatureCollection',
        features: (fc.features || [])
          .filter((f) => f.geometry && featureOverlapsRegion(f.geometry, region))
          .map((f) => {
          const density = f.properties?.Density ?? f.properties?.density ?? 0;
          let densityLabel: string;
          if (density >= 27) densityLabel = 'Heavy';
          else if (density >= 16) densityLabel = 'Medium';
          else if (density >= 5) densityLabel = 'Light';
          else densityLabel = 'Unknown';

          return {
            ...f,
            properties: {
              ...f.properties,
              densityLabel,
            },
          };
        }),
      };
    }

    return NextResponse.json({
      fires: firePoints,
      smoke: smokeGeoJSON,
      date: `${year}-${month}-${day}`,
      region: regionParam,
      totalFires,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300'
      }
    });
  } catch (err) {
    console.error('HMS API error:', err);
    return NextResponse.json({
      fires: [],
      smoke: null,
      date: `${year}-${month}-${day}`,
      error: 'HMS data may not be available for this date yet',
    });
  }
}

async function fetchAndParseShapefile(url: string): Promise<GeoJSON.FeatureCollection | null> {
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const buffer = await res.arrayBuffer();
  const geojson = await shp(buffer);

  // shpjs can return a single FeatureCollection or an array
  if (Array.isArray(geojson)) {
    return geojson[0] as GeoJSON.FeatureCollection;
  }
  return geojson as GeoJSON.FeatureCollection;
}
