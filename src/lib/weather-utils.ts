// ============================================================
// Weather Utility Functions
// Unit conversions, wind direction, sky cover abbreviations
// ============================================================

import { COMPASS_DIRECTIONS } from './constants';

/** Convert Celsius to Fahrenheit */
export function celsiusToFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

/** Convert km/h to mph */
export function kmhToMph(kmh: number): number {
  return kmh * 0.621371;
}

/** Convert knots to mph */
export function knotsToMph(knots: number): number {
  return knots * 1.15078;
}

/** Convert meters to feet */
export function metersToFeet(m: number): number {
  return m * 3.28084;
}

/** Convert mph to m/s */
export function mphToMs(mph: number): number {
  return mph * 0.44704;
}

/** Convert degrees to 16-point cardinal direction */
export function degreesToCardinal(degrees: number): string {
  const index = Math.round(degrees / 22.5) % 16;
  return COMPASS_DIRECTIONS[index];
}

/** Get sky cover abbreviation from percentage */
export function getSkyCoverAbbr(percent: number): string {
  if (percent <= 10) return 'CLR';
  if (percent <= 30) return 'FW';
  if (percent <= 50) return 'PC';
  if (percent <= 70) return 'MC';
  if (percent <= 90) return 'MCR';
  return 'OVC';
}

/** Get weather type abbreviation from NWS weather code */
export function getWeatherAbbr(code: string | null): string {
  if (!code) return '';
  const lower = code.toLowerCase();
  if (lower.includes('thunderstorm')) return 'T';
  if (lower.includes('rain') || lower.includes('drizzle')) return 'RW';
  if (lower.includes('snow') || lower.includes('flurries')) return 'S';
  if (lower.includes('fog')) return 'F';
  if (lower.includes('smoke')) return 'K';
  if (lower.includes('haze')) return 'H';
  return '';
}

/** Format wind direction + speed string */
export function formatWind(direction: string, speed: number, gust?: number): string {
  let str = `${direction} ${Math.round(speed)} mph`;
  if (gust && gust > speed + 5) {
    str += ` G${Math.round(gust)}`;
  }
  return str;
}

/** Format large numbers with commas */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/** Parse NWS ISO duration (e.g., "PT1H" = 1 hour) */
export function parseISODuration(duration: string): number {
  const match = duration.match(/PT(\d+)H/);
  return match ? parseInt(match[1]) : 1;
}

/**
 * Parse NWS grid data time series
 * NWS returns values as {validTime: "ISO/Duration", value: number}
 */
export function expandNWSTimeSeries(
  values: Array<{ validTime: string; value: number }>,
  hoursNeeded: number = 72
): Array<{ time: string; value: number }> {
  const result: Array<{ time: string; value: number }> = [];

  for (const entry of values) {
    const [timeStr, durationStr] = entry.validTime.split('/');
    const startTime = new Date(timeStr);
    const hours = parseISODuration(durationStr);

    for (let h = 0; h < hours; h++) {
      const time = new Date(startTime.getTime() + h * 3600000);
      result.push({ time: time.toISOString(), value: entry.value });
    }
  }

  return result.slice(0, hoursNeeded);
}

/** Get MFC wind direction as meteorological degrees (N=0, clockwise) */
export function windDirectionToDegrees(dir: string): number | null {
  const map: Record<string, number> = {
    N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
  };
  return map[dir.toUpperCase()] ?? null;
}

/** Format hour for display (e.g., "8 AM", "2 PM") */
export function formatHour(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
}

/** Format date for display */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Format full date + time */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
