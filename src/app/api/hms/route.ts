import { NextRequest, NextResponse } from 'next/server';
import shp from 'shpjs';

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date');
  const date = dateParam ? new Date(dateParam) : new Date();

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

    // Process fire points
    let firePoints: Array<Record<string, unknown>> = [];
    if (fires.status === 'fulfilled' && fires.value) {
      const fc = fires.value as GeoJSON.FeatureCollection;
      firePoints = (fc.features || []).map((f) => ({
        lat: f.properties?.Lat || (f.geometry as GeoJSON.Point)?.coordinates?.[1],
        lon: f.properties?.Lon || (f.geometry as GeoJSON.Point)?.coordinates?.[0],
        satellite: f.properties?.Satellite || f.properties?.satellite || '',
        method: f.properties?.Method || f.properties?.method || '',
        frp: f.properties?.FRP || f.properties?.frp || 0,
        time: f.properties?.Time || f.properties?.time || '',
      }));
    }

    // Process smoke polygons — add density classification
    let smokeGeoJSON: GeoJSON.FeatureCollection | null = null;
    if (smoke.status === 'fulfilled' && smoke.value) {
      const fc = smoke.value as GeoJSON.FeatureCollection;
      smokeGeoJSON = {
        type: 'FeatureCollection',
        features: (fc.features || []).map((f) => {
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
  const res = await fetch(url);
  if (!res.ok) return null;

  const buffer = await res.arrayBuffer();
  const geojson = await shp(buffer);

  // shpjs can return a single FeatureCollection or an array
  if (Array.isArray(geojson)) {
    return geojson[0] as GeoJSON.FeatureCollection;
  }
  return geojson as GeoJSON.FeatureCollection;
}
