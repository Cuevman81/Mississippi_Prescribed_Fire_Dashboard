import { describe, it, expect } from 'vitest';
import {
  celsiusToFahrenheit,
  kmhToMph,
  knotsToMph,
  metersToFeet,
  mphToMs,
  degreesToCardinal,
  getSkyCoverAbbr,
  getWeatherAbbr,
  formatWind,
  parseISODuration,
  convertNWSValue,
  expandNWSTimeSeries,
  expandNWSTimeSeriesToMap,
} from './weather-utils';

describe('unit conversions', () => {
  it('converts Celsius to Fahrenheit', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
  });

  it('converts km/h to mph', () => {
    expect(kmhToMph(100)).toBeCloseTo(62.14, 2);
  });

  it('converts knots to mph', () => {
    expect(knotsToMph(10)).toBeCloseTo(11.51, 2);
  });

  it('converts meters to feet', () => {
    expect(metersToFeet(1000)).toBeCloseTo(3280.84, 2);
  });

  it('converts mph to m/s', () => {
    expect(mphToMs(10)).toBeCloseTo(4.47, 2);
  });
});

describe('convertNWSValue (uom-driven conversion)', () => {
  it('converts degC to Fahrenheit', () => {
    expect(convertNWSValue(0, 'wmoUnit:degC', 'F')).toBe(32);
    expect(convertNWSValue(33.89, 'wmoUnit:degC', 'F')).toBeCloseTo(93, 0);
  });

  it('converts km/h to mph', () => {
    expect(convertNWSValue(9.26, 'wmoUnit:km_h-1', 'mph')).toBeCloseTo(5.75, 2);
  });

  it('converts m/s to mph', () => {
    expect(convertNWSValue(10, 'wmoUnit:m_s-1', 'mph')).toBeCloseTo(22.37, 2);
  });

  it('converts knots to mph', () => {
    expect(convertNWSValue(10, 'wmoUnit:kt', 'mph')).toBeCloseTo(11.51, 2);
  });

  it('converts meters to feet', () => {
    expect(convertNWSValue(1470.9648, 'wmoUnit:m', 'ft')).toBeCloseTo(4826.0, 0);
  });

  it('passes percent values through unchanged', () => {
    expect(convertNWSValue(85, 'wmoUnit:percent', 'percent')).toBe(85);
  });

  it('passes values through when the unit is already the target', () => {
    expect(convertNWSValue(50, 'wmoUnit:degF', 'F')).toBe(50);
  });

  it('falls back to standard NWS units when uom is missing', () => {
    expect(convertNWSValue(0, undefined, 'F')).toBe(32); // assumes degC
    expect(convertNWSValue(100, undefined, 'mph')).toBeCloseTo(62.14, 2); // assumes km/h
    expect(convertNWSValue(1000, undefined, 'ft')).toBeCloseTo(3280.84, 2); // assumes m
  });

  // Regression test for the ventilation index bug: NWS transportWindSpeed
  // is reported in km/h (wmoUnit:km_h-1). Treating it as knots overstated
  // transport wind by ~85% and inflated VI accordingly.
  it('REGRESSION: km/h transport wind must not be interpreted as knots', () => {
    const kmh = 11.112; // real NWS value, verified 2026-07-02 for grid JAN/76,63
    const correctMph = convertNWSValue(kmh, 'wmoUnit:km_h-1', 'mph');
    expect(correctMph).toBeCloseTo(6.9, 1);
    const knotsInterpretation = knotsToMph(kmh); // ~12.8 — the old bug
    expect(Math.abs(correctMph - knotsInterpretation)).toBeGreaterThan(5);
  });
});

describe('parseISODuration', () => {
  it('parses hour durations', () => {
    expect(parseISODuration('PT1H')).toBe(1);
    expect(parseISODuration('PT3H')).toBe(3);
    expect(parseISODuration('PT12H')).toBe(12);
  });

  it('parses day durations', () => {
    expect(parseISODuration('P1D')).toBe(24);
  });

  it('parses combined day+hour durations', () => {
    expect(parseISODuration('P1DT6H')).toBe(30);
    expect(parseISODuration('P2DT1H')).toBe(49);
  });

  it('falls back to 1 hour for unparseable or sub-hour durations', () => {
    expect(parseISODuration('PT30M')).toBe(1);
    expect(parseISODuration('garbage')).toBe(1);
    expect(parseISODuration('')).toBe(1);
  });
});

describe('expandNWSTimeSeries', () => {
  it('expands a multi-hour duration into hourly entries', () => {
    const result = expandNWSTimeSeries(
      [{ validTime: '2026-01-01T00:00:00+00:00/PT3H', value: 5 }],
      72
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ time: '2026-01-01T00:00:00.000Z', value: 5 });
    expect(result[2]).toEqual({ time: '2026-01-01T02:00:00.000Z', value: 5 });
  });

  it('truncates to hoursNeeded', () => {
    const result = expandNWSTimeSeries(
      [{ validTime: '2026-01-01T00:00:00+00:00/P1D', value: 1 }],
      6
    );
    expect(result).toHaveLength(6);
  });
});

describe('expandNWSTimeSeriesToMap', () => {
  it('keys values by hourly ISO timestamp', () => {
    const map = expandNWSTimeSeriesToMap([
      { validTime: '2026-01-01T00:00:00+00:00/PT1H', value: 1 },
      { validTime: '2026-01-01T03:00:00+00:00/PT2H', value: 2 },
    ]);
    expect(map.get('2026-01-01T00:00:00.000Z')).toBe(1);
    expect(map.get('2026-01-01T03:00:00.000Z')).toBe(2);
    expect(map.get('2026-01-01T04:00:00.000Z')).toBe(2);
  });

  // Regression test for index-based series alignment: series with gaps or
  // different start times must not contribute values to uncovered hours.
  it('REGRESSION: leaves gaps for hours a series does not cover', () => {
    const map = expandNWSTimeSeriesToMap([
      { validTime: '2026-01-01T00:00:00+00:00/PT1H', value: 1 },
      { validTime: '2026-01-01T03:00:00+00:00/PT1H', value: 2 },
    ]);
    expect(map.has('2026-01-01T01:00:00.000Z')).toBe(false);
    expect(map.has('2026-01-01T02:00:00.000Z')).toBe(false);
  });

  it('handles empty/missing input', () => {
    expect(expandNWSTimeSeriesToMap([]).size).toBe(0);
  });
});

describe('degreesToCardinal', () => {
  it('maps principal directions', () => {
    expect(degreesToCardinal(0)).toBe('N');
    expect(degreesToCardinal(90)).toBe('E');
    expect(degreesToCardinal(180)).toBe('S');
    expect(degreesToCardinal(270)).toBe('W');
  });

  it('maps intermediate directions and wraps at 360', () => {
    expect(degreesToCardinal(45)).toBe('NE');
    expect(degreesToCardinal(337.5)).toBe('NNW');
    expect(degreesToCardinal(355)).toBe('N');
  });
});

describe('getSkyCoverAbbr', () => {
  it('maps sky cover percentage to abbreviations', () => {
    expect(getSkyCoverAbbr(5)).toBe('CLR');
    expect(getSkyCoverAbbr(25)).toBe('FW');
    expect(getSkyCoverAbbr(45)).toBe('PC');
    expect(getSkyCoverAbbr(65)).toBe('MC');
    expect(getSkyCoverAbbr(85)).toBe('MCR');
    expect(getSkyCoverAbbr(100)).toBe('OVC');
  });
});

describe('getWeatherAbbr', () => {
  it('maps NWS weather codes to abbreviations', () => {
    expect(getWeatherAbbr('thunderstorms')).toBe('T');
    expect(getWeatherAbbr('light_rain')).toBe('RW');
    expect(getWeatherAbbr('fog')).toBe('F');
    expect(getWeatherAbbr('smoke')).toBe('K');
    expect(getWeatherAbbr(null)).toBe('');
    expect(getWeatherAbbr('clear')).toBe('');
  });
});

describe('formatWind', () => {
  it('includes gusts only when meaningfully above sustained speed', () => {
    expect(formatWind('SW', 10)).toBe('SW 10 mph');
    expect(formatWind('SW', 10, 12)).toBe('SW 10 mph'); // within 5 mph
    expect(formatWind('SW', 10, 18)).toBe('SW 10 mph G18');
  });
});
