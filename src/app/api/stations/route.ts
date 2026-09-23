import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 20);
  if (limited) return limited;

  const stationId = request.nextUrl.searchParams.get('id');

  if (!stationId || !/^[A-Za-z0-9_]{3,10}$/.test(stationId)) {
    return NextResponse.json({ error: 'Invalid station ID' }, { status: 400 });
  }

  try {
    // IEM's currents API works for any network (MS_ASOS, AK_ASOS, AWOS...)
    // and returns the METAR fields we read. The older json/current.py
    // endpoint uses different field names (airtemp[F], windspeed[kt]) and
    // returned hasData with no temperature, humidity or wind.
    const res = await fetch(
      `https://mesonet.agron.iastate.edu/api/1/currents.json?station=${encodeURIComponent(stationId)}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'Station data unavailable', hasData: false }, { status: 502 });
    }

    const payload = await res.json();
    const rows = ((payload?.data ?? []) as Record<string, unknown>[])
      .filter((r) => String(r.station ?? '').toUpperCase() === stationId.toUpperCase())
      // Newest observation first if the ID appears in more than one network
      .sort((a, b) => String(b.utc_valid ?? '').localeCompare(String(a.utc_valid ?? '')));

    const formatted = rows.length ? formatStationData(rows[0]) : null;
    if (!formatted) {
      return NextResponse.json({ error: 'No recent observation', hasData: false }, { status: 404 });
    }
    return NextResponse.json(formatted);
  } catch (err) {
    console.error('Station API error:', err);
    return NextResponse.json({ error: 'Station service unavailable', hasData: false }, { status: 500 });
  }
}

// Routine ASOS/AWOS reports are hourly; an observation older than this has
// missed at least one, so the dashboard falls back to the forecast hour
// instead of calling it real-time
const MAX_OBS_AGE_MS = 2 * 3600 * 1000;

function formatStationData(obs: Record<string, unknown>): Record<string, unknown> | null {
  const utcValid = typeof obs.utc_valid === 'string' ? obs.utc_valid : '';
  const obsMs = Date.parse(utcValid);
  if (!Number.isFinite(obsMs) || Date.now() - obsMs > MAX_OBS_AGE_MS) return null;
  if (obs.tmpf == null && obs.relh == null && obs.sknt == null) return null;

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
    rawTime: utcValid,
  };
}
