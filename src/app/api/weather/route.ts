import { NextRequest, NextResponse } from 'next/server';

const NWS_HEADERS = {
  'User-Agent': process.env.NWS_USER_AGENT || 'PrescribedBurnApp/3.0',
  'Accept': 'application/geo+json',
};

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing lat/lon' }, { status: 400 });
  }

  try {
    // Step 1: Get point metadata (NWS office, grid, timezone)
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      { headers: NWS_HEADERS }
    );

    if (!pointRes.ok) {
      return NextResponse.json({ error: 'NWS point lookup failed' }, { status: pointRes.status });
    }

    const pointData = await pointRes.json();
    const props = pointData.properties;

    const metadata = {
      cwa: props.cwa,
      forecastGridData: props.forecastGridData,
      timeZone: props.timeZone,
      forecastUrl: props.forecast,
      county: props.relativeLocation?.properties?.city || '',
      state: props.relativeLocation?.properties?.state || '',
    };

    // Step 2: Get grid forecast data (72-hour hourly)
    const gridRes = await fetch(props.forecastGridData, { headers: NWS_HEADERS });
    if (!gridRes.ok) {
      return NextResponse.json({ error: 'NWS grid data failed' }, { status: gridRes.status });
    }

    const gridData = await gridRes.json();
    const gp = gridData.properties;

    // Step 3: Get narrative forecast
    const forecastRes = await fetch(props.forecast, { headers: NWS_HEADERS });
    let narrativePeriods: unknown[] = [];
    if (forecastRes.ok) {
      const forecastData = await forecastRes.json();
      narrativePeriods = forecastData.properties?.periods || [];
    }

    // Extract grid data time series
    const gridFields = {
      temperature: gp.temperature?.values || [],
      relativeHumidity: gp.relativeHumidity?.values || [],
      windSpeed: gp.windSpeed?.values || [],
      windDirection: gp.windDirection?.values || [],
      windGust: gp.windGust?.values || [],
      skyCover: gp.skyCover?.values || [],
      weather: gp.weather?.values || [],
      mixingHeight: gp.mixingHeight?.values || [],
      transportWindSpeed: gp.transportWindSpeed?.values || [],
      transportWindDirection: gp.transportWindDirection?.values || [],
      hainesIndex: gp.hainesIndex?.values || [],
      probabilityOfPrecipitation: gp.probabilityOfPrecipitation?.values || [],
    };

    return NextResponse.json({
      metadata,
      gridFields,
      narrativePeriods,
    });
  } catch (err) {
    console.error('Weather API error:', err);
    return NextResponse.json({ error: 'Weather service unavailable' }, { status: 500 });
  }
}
