import { describe, expect, it } from 'vitest';
import { formatUsdmDate, usdmValidDate } from './drought';

describe('usdmValidDate', () => {
  it('reads the valid date from the USDM shapefile name', () => {
    // Name shpjs reported for USDM_current_M.zip on 2026-10-17
    expect(usdmValidDate('USDM_20261013')).toBe('2026-10-13');
    expect(usdmValidDate('usdm_20261013.shp')).toBe('2026-10-13');
  });

  it('returns null rather than guessing when there is no real date', () => {
    expect(usdmValidDate(undefined)).toBeNull();
    expect(usdmValidDate('USDM_current_M')).toBeNull();
    expect(usdmValidDate('USDM_20261345')).toBeNull();
    expect(usdmValidDate('USDM_20260230')).toBeNull();
  });
});

describe('formatUsdmDate', () => {
  it('formats the date as written, whatever the local time zone', () => {
    expect(formatUsdmDate('2026-10-13')).toBe('Oct 13, 2026');
    expect(formatUsdmDate('2027-01-01')).toBe('Jan 1, 2027');
  });
});
