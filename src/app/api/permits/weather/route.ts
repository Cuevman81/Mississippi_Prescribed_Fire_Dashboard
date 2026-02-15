import { NextRequest, NextResponse } from 'next/server';

const NWS_UA = process.env.NWS_USER_AGENT || 'PrescribedBurnApp/3.0';

interface CountyWeather {
  windSpeed: number;
  windGust: number;
  windDirection: number;
  windDirectionCardinal: string;
  mixingHeight: number;
  transportWindSpeed: number;
  transportWindDirection: number;
  ventilationIndex: number;
  dispersionQuality: string;
  source: 'NWS Live';
}

// Cache: county key → weather data, refreshed every 15 min
const cache = new Map<string, { data: CountyWeather; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

/**
 * POST /api/permits/weather
 * Body: { counties: [{ county: string, lat: number, lon: number }] }
 * Returns: { [county]: CountyWeather }
 */
export async function POST(request: NextRequest) {
  try {
    const { counties } = await request.json() as {
      counties: { county: string; lat: number; lon: number }[];
    };

    if (!counties || !counties.length) {
      return NextResponse.json({});
    }

    const result: Record<string, CountyWeather> = {};

    // Process each unique county
    for (const { county, lat, lon } of counties) {
      const cacheKey = `${county}_${lat.toFixed(2)}_${lon.toFixed(2)}`;

      // Check cache
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        result[county] = cached.data;
        continue;
      }

      try {
        // Step 1: Get NWS grid metadata
        const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
          headers: { 'User-Agent': NWS_UA },
        });

        if (!pointRes.ok) continue;

        const pointData = await pointRes.json();
        const gridUrl = pointData.properties?.forecastGridData;

        if (!gridUrl) continue;

        // Step 2: Fetch grid forecast
        const gridRes = await fetch(gridUrl, {
          headers: { 'User-Agent': NWS_UA },
        });

        if (!gridRes.ok) continue;

        const gridData = await gridRes.json();
        const props = gridData.properties;

        // Step 3: Find current hour values
        const now = Date.now();
        const getValue = (series: { values?: Array<{ validTime: string; value: number }> }): number => {
          if (!series?.values?.length) return 0;

          for (const entry of series.values) {
            const [start, duration] = entry.validTime.split('/');
            const startMs = new Date(start).getTime();
            // Parse ISO 8601 duration (simplified: hours)
            const hours = parseDurationHours(duration);
            const endMs = startMs + hours * 3600000;

            if (now >= startMs && now < endMs) {
              return entry.value;
            }
          }

          // Fallback: closest to now
          let bestVal = series.values[0].value;
          let bestDiff = Infinity;
          for (const entry of series.values) {
            const diff = Math.abs(new Date(entry.validTime.split('/')[0]).getTime() - now);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestVal = entry.value;
            }
          }
          return bestVal;
        };

        // Extract current values
        const windSpeedKmh = getValue(props.windSpeed);
        const windGustKmh = getValue(props.windGust);
        const windDirDeg = getValue(props.windDirection);
        const mixingHeightM = getValue(props.mixingHeight);
        const transportWindMs = getValue(props.transportWindSpeed);
        const transportWindDir = getValue(props.transportWindDirection);

        // Convert units
        const windSpeedMph = Math.round(windSpeedKmh * 0.621371);
        const windGustMph = Math.round(windGustKmh * 0.621371);
        const mixingHeightFt = Math.round(mixingHeightM * 3.28084);
        const transportWindMph = Math.round(transportWindMs * 2.23694);
        const vi = mixingHeightFt * transportWindMph;

        let dispersionQuality: string;
        if (vi < 20000) dispersionQuality = 'Poor (Trapping)';
        else if (vi < 40000) dispersionQuality = 'Fair';
        else dispersionQuality = 'Good (Clearing)';

        const weather: CountyWeather = {
          windSpeed: windSpeedMph,
          windGust: windGustMph,
          windDirection: windDirDeg,
          windDirectionCardinal: degreesToCardinal(windDirDeg),
          mixingHeight: mixingHeightFt,
          transportWindSpeed: transportWindMph,
          transportWindDirection: transportWindDir,
          ventilationIndex: Math.round(vi),
          dispersionQuality,
          source: 'NWS Live',
        };

        cache.set(cacheKey, { data: weather, timestamp: Date.now() });
        result[county] = weather;
      } catch {
        // Skip this county on error
        continue;
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('Permit weather API error:', err);
    return NextResponse.json({ error: 'Weather enrichment failed' }, { status: 500 });
  }
}

function parseDurationHours(duration: string): number {
  // Parse ISO 8601 duration: PT1H, PT2H, P1D, etc.
  const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?/);
  if (!match) return 1;
  const days = parseInt(match[1] || '0');
  const hours = parseInt(match[2] || '0');
  return days * 24 + (hours || 1);
}

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx] || 'N';
}
