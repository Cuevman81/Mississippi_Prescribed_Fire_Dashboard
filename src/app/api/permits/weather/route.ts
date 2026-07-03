import { NextRequest, NextResponse } from 'next/server';
import { convertNWSValue, parseISODuration } from '@/lib/weather-utils';
import { rateLimit } from '@/lib/rate-limit';

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
  const limited = rateLimit(request, 10);
  if (limited) return limited;

  try {
    const { counties } = await request.json() as {
      counties: { county: string; lat: number; lon: number }[];
    };

    if (!counties || !counties.length) {
      return NextResponse.json({});
    }

    // Size limit to prevent DoS attacks
    if (counties.length > 100) {
      return NextResponse.json({ error: 'Too many counties (maximum 100)' }, { status: 400 });
    }

    // Data type and range verification
    for (const entry of counties) {
      if (!entry.county || typeof entry.county !== 'string' || entry.county.length > 100) {
        return NextResponse.json({ error: 'Invalid county name' }, { status: 400 });
      }
      if (typeof entry.lat !== 'number' || isNaN(entry.lat) || entry.lat < -90 || entry.lat > 90) {
        return NextResponse.json({ error: 'Invalid latitude value' }, { status: 400 });
      }
      if (typeof entry.lon !== 'number' || isNaN(entry.lon) || entry.lon < -180 || entry.lon > 180) {
        return NextResponse.json({ error: 'Invalid longitude value' }, { status: 400 });
      }
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
            // Parse ISO 8601 duration
            const hours = parseISODuration(duration);
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

        // Extract current values with dynamic conversions based on uom
        const windSpeedRaw = getValue(props.windSpeed);
        const windSpeedMph = Math.round(convertNWSValue(windSpeedRaw, props.windSpeed?.uom, 'mph'));

        const windGustRaw = getValue(props.windGust);
        const windGustMph = Math.round(convertNWSValue(windGustRaw, props.windGust?.uom, 'mph'));

        const windDirDeg = getValue(props.windDirection);

        const mixingHeightRaw = getValue(props.mixingHeight);
        const mixingHeightFt = Math.round(convertNWSValue(mixingHeightRaw, props.mixingHeight?.uom, 'ft'));

        const transportWindRaw = getValue(props.transportWindSpeed);
        const transportWindMph = Math.round(convertNWSValue(transportWindRaw, props.transportWindSpeed?.uom, 'mph'));

        const transportWindDir = getValue(props.transportWindDirection);
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



function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx] || 'N';
}
