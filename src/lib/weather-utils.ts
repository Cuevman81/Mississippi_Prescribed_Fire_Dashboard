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
  // Parse ISO 8601 duration: PT1H, PT2H, P1D, P1DT6H, etc.
  const match = duration.match(/P(?:(\d+)D)?(?:T(\d+)H)?/);
  if (!match) return 1;
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const totalHours = days * 24 + hours;
  return totalHours > 0 ? totalHours : 1;
}

/** Convert NWS values based on their Unit of Measure (uom) */
export function convertNWSValue(
  value: number,
  uom: string | undefined,
  targetUnit: 'F' | 'mph' | 'ft' | 'percent'
): number {
  if (!uom) {
    if (targetUnit === 'F') return celsiusToFahrenheit(value);
    if (targetUnit === 'mph') return kmhToMph(value);
    if (targetUnit === 'ft') return metersToFeet(value);
    return value;
  }

  const unit = uom.replace('wmoUnit:', '');
  switch (targetUnit) {
    case 'F':
      if (unit === 'degC') {
        return celsiusToFahrenheit(value);
      }
      return value;
    case 'mph':
      if (unit === 'km_h-1') {
        return kmhToMph(value);
      }
      if (unit === 'm_s-1') {
        return value * 2.23694; // m/s to mph
      }
      if (unit === 'nmi_h-1' || unit === 'kt') {
        return knotsToMph(value);
      }
      return value;
    case 'ft':
      if (unit === 'm') {
        return metersToFeet(value);
      }
      return value;
    case 'percent':
      return value;
    default:
      return value;
  }
}

/**
 * Parse NWS grid data time series into a Map of ISO hour timestamp -> value
 */
export function expandNWSTimeSeriesToMap(
  values: Array<{ validTime: string; value: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  if (!values) return map;

  for (const entry of values) {
    const [timeStr, durationStr] = entry.validTime.split('/');
    const startTime = new Date(timeStr);
    const hours = parseISODuration(durationStr);

    for (let h = 0; h < hours; h++) {
      const time = new Date(startTime.getTime() + h * 3600000);
      map.set(time.toISOString(), entry.value);
    }
  }

  return map;
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
