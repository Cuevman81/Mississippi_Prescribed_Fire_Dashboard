import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.AIRNOW_API_KEY;
const MS_BBOX = '-91.655,30.174,-88.098,34.996';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type'); // current | forecast | monitors
  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');

  if (!API_KEY) {
    return NextResponse.json({ error: 'AirNow API key not configured' }, { status: 500 });
  }

  try {
    switch (type) {
      case 'current':
        return await getCurrentAQI(lat!, lon!);
      case 'forecast':
        return await getForecastAQI(lat!, lon!);
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

async function getCurrentAQI(lat: string, lon: string) {
  const res = await fetch(
    `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${lat}&longitude=${lon}&distance=25&API_KEY=${API_KEY}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Current AQI unavailable' }, { status: res.status });
  }

  const raw = await res.json();

  // Normalize AirNow PascalCase response to our camelCase AQIObservation interface
  // AirNow returns: { DateObserved, HourObserved, LocalTimeZone, ReportingArea,
  //   StateCode, Latitude, Longitude, ParameterName, AQI, Category: { Number, Name } }
  const data = (raw as Record<string, unknown>[]).map((obs: Record<string, unknown>) => ({
    dateObserved: obs.DateObserved ?? obs.dateObserved,
    hourObserved: obs.HourObserved ?? obs.hourObserved,
    localTimeZone: obs.LocalTimeZone ?? obs.localTimeZone,
    reportingArea: obs.ReportingArea ?? obs.reportingArea,
    stateCode: obs.StateCode ?? obs.stateCode,
    latitude: obs.Latitude ?? obs.latitude,
    longitude: obs.Longitude ?? obs.longitude,
    parameterName: obs.ParameterName ?? obs.parameterName,
    aqi: obs.AQI ?? obs.aqi ?? 0,
    category: normalizeCategoryField(obs.Category ?? obs.category),
  }));

  return NextResponse.json(data);
}

async function getForecastAQI(lat: string, lon: string) {
  const res = await fetch(
    `https://www.airnowapi.org/aq/forecast/latLong/?format=application/json&latitude=${lat}&longitude=${lon}&distance=25&API_KEY=${API_KEY}`
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'AQI forecast unavailable' }, { status: res.status });
  }

  const raw = await res.json();

  // Normalize AirNow PascalCase response to our camelCase AQIForecast interface
  // AirNow returns: { DateIssue, DateForecast, ReportingArea, StateCode,
  //   Latitude, Longitude, ParameterName, AQI, Category: { Number, Name },
  //   ActionDay, Discussion }
  const data = (raw as Record<string, unknown>[]).map((f: Record<string, unknown>) => ({
    dateIssue: f.DateIssue ?? f.dateIssue,
    dateForecast: f.DateForecast ?? f.dateForecast,
    reportingArea: f.ReportingArea ?? f.reportingArea,
    stateCode: f.StateCode ?? f.stateCode,
    latitude: f.Latitude ?? f.latitude,
    longitude: f.Longitude ?? f.longitude,
    parameterName: f.ParameterName ?? f.parameterName,
    aqi: f.AQI ?? f.aqi ?? -1,
    category: normalizeCategoryField(f.Category ?? f.category),
    actionDay: f.ActionDay ?? f.actionDay ?? false,
    discussion: f.Discussion ?? f.discussion ?? '',
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

  const res = await fetch(`https://www.airnowapi.org/aq/data/?${params}`);

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

/**
 * Normalize the AirNow Category field from PascalCase { Number, Name }
 * to camelCase { number, name } to match our AQICategory interface.
 * Handles: object with PascalCase keys, already-normalized objects, or missing values.
 */
function normalizeCategoryField(cat: unknown): { number: number; name: string } {
  if (!cat || typeof cat !== 'object') {
    return { number: 0, name: 'Unknown' };
  }

  const c = cat as Record<string, unknown>;

  return {
    number: (c.Number ?? c.number ?? 0) as number,
    name: (c.Name ?? c.name ?? 'Unknown') as string,
  };
}
