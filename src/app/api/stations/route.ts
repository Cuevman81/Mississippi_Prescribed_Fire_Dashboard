import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const stationId = request.nextUrl.searchParams.get('id');

  if (!stationId) {
    return NextResponse.json({ error: 'Missing station ID' }, { status: 400 });
  }

  try {
    // Try multiple network formats — MS stations often use state-prefixed networks
    const networks = ['ASOS', `MS_ASOS`, 'AWOS', `MS_AWOS`];

    for (const network of networks) {
      try {
        const res = await fetch(
          `https://mesonet.agron.iastate.edu/json/current.py?station=${stationId}&network=${network}`
        );

        if (res.ok) {
          const data = await res.json();
          const formatted = formatStationData(data);
          if ((formatted as Record<string, unknown>).hasData) {
            return NextResponse.json(formatted);
          }
        }
      } catch {
        // Try next network
      }
    }

    // Fallback: try the station without network restriction using the geojson endpoint
    try {
      const res = await fetch(
        `https://mesonet.agron.iastate.edu/geojson/network/MS_ASOS.geojson`
      );
      if (res.ok) {
        const geoData = await res.json();
        const feature = geoData.features?.find(
          (f: Record<string, unknown>) =>
            (f.properties as Record<string, string>)?.sid === stationId
        );
        if (feature?.properties) {
          const p = feature.properties as Record<string, unknown>;
          return NextResponse.json({
            hasData: true,
            stationId: p.sid,
            temp: p.tmpf,
            humidity: p.relh,
            windSpeed: p.sknt != null ? Math.round((p.sknt as number) * 1.15078 * 10) / 10 : null,
            windDirection: p.drct,
            windGust: p.gust != null ? Math.round((p.gust as number) * 1.15078 * 10) / 10 : null,
            visibility: p.vsby,
            time: p.local_valid,
            rawTime: p.utc_valid,
          });
        }
      }
    } catch {
      // Fallback also failed
    }

    return NextResponse.json({ error: 'Station data unavailable', hasData: false }, { status: 404 });
  } catch (err) {
    console.error('Station API error:', err);
    return NextResponse.json({ error: 'Station service unavailable', hasData: false }, { status: 500 });
  }
}

function formatStationData(data: Record<string, unknown>): Record<string, unknown> {
  const obs = data.last_ob as Record<string, unknown> | undefined;
  if (!obs) {
    return { error: 'No observations available', hasData: false };
  }

  // Convert wind speed from knots to mph
  const windSpeedKnots = obs.sknt as number | null;
  const windGustKnots = obs.gust as number | null;

  return {
    hasData: true,
    stationId: obs.station,
    temp: obs.tmpf, // Already in °F
    humidity: obs.relh,
    windSpeed: windSpeedKnots != null ? Math.round(windSpeedKnots * 1.15078 * 10) / 10 : null,
    windDirection: obs.drct,
    windGust: windGustKnots != null ? Math.round(windGustKnots * 1.15078 * 10) / 10 : null,
    visibility: obs.vsby,
    time: obs.local_valid,
    rawTime: obs.utc_valid,
  };
}
