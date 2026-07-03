import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const NWS_HEADERS = {
  'User-Agent': process.env.NWS_USER_AGENT || 'PrescribedBurnApp/3.0',
  'Accept': 'application/geo+json',
};

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 20);
  if (limited) return limited;

  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing lat/lon' }, { status: 400 });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
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

    // Extract grid data time series with uom
    const gridFields = {
      temperature: { values: gp.temperature?.values || [], uom: gp.temperature?.uom || '' },
      relativeHumidity: { values: gp.relativeHumidity?.values || [], uom: gp.relativeHumidity?.uom || '' },
      windSpeed: { values: gp.windSpeed?.values || [], uom: gp.windSpeed?.uom || '' },
      windDirection: { values: gp.windDirection?.values || [], uom: gp.windDirection?.uom || '' },
      windGust: { values: gp.windGust?.values || [], uom: gp.windGust?.uom || '' },
      skyCover: { values: gp.skyCover?.values || [], uom: gp.skyCover?.uom || '' },
      weather: { values: gp.weather?.values || [], uom: gp.weather?.uom || '' },
      mixingHeight: { values: gp.mixingHeight?.values || [], uom: gp.mixingHeight?.uom || '' },
      transportWindSpeed: { values: gp.transportWindSpeed?.values || [], uom: gp.transportWindSpeed?.uom || '' },
      transportWindDirection: { values: gp.transportWindDirection?.values || [], uom: gp.transportWindDirection?.uom || '' },
      hainesIndex: { values: gp.hainesIndex?.values || [], uom: gp.hainesIndex?.uom || '' },
      probabilityOfPrecipitation: { values: gp.probabilityOfPrecipitation?.values || [], uom: gp.probabilityOfPrecipitation?.uom || '' },
      ceilingHeight: { values: gp.ceilingHeight?.values || [], uom: gp.ceilingHeight?.uom || '' },
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
