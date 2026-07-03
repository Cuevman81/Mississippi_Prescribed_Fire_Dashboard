import { describe, it, expect } from 'vitest';
import {
  solarElevationDeg,
  netRadiationIndex,
  stabilityClass,
  atmosphericDispersionIndex,
  adiCategory,
  lvori,
  lvoriGuidance,
} from './dispersion';

describe('atmosphericDispersionIndex — Lavdas (1986) official test vectors', () => {
  // All 27 published test cases from Table 5 of USDA Forest Service
  // Research Paper SE-256. IDYNT 1 = day, 2 = night.
  // [isDay, stability, mixingHeightM, transportWindMs, expectedDI]
  const vectors: Array<[number, number, number, number, number]> = [
    [1, 1, 120, 0.5, 2.382],
    [1, 1, 120, 1, 2.382],
    [1, 1, 240, 1, 2.382],
    [1, 1, 240, 2, 4.764],
    [1, 1, 1200, 1, 11.259],
    [1, 1, 5000, 1, 37.663],
    [1, 1, 8000, 1, 44.208],
    [1, 2, 240, 1, 2.358],
    [1, 2, 1200, 1, 9.983],
    [1, 2, 5000, 1, 22.479],
    [1, 3, 240, 1, 2.320],
    [1, 3, 1200, 1, 8.263],
    [1, 3, 5000, 1, 12.487],
    [1, 4, 240, 1, 2.237],
    [1, 4, 600, 1, 4.435],
    [1, 4, 1200, 1, 5.965],
    [1, 4, 5000, 1, 7.358],
    [2, 4, 240, 1, 2.093],
    [2, 4, 600, 1, 3.152],
    [2, 4, 1200, 1, 3.152],
    [2, 5, 240, 1, 1.471],
    [2, 5, 600, 1, 1.471],
    [2, 6, 240, 1, 0.986],
    [2, 6, 600, 1, 0.986],
    [2, 7, 240, 1, 0.986],
  ];

  for (const [idynt, istab, amix, u, expected] of vectors) {
    it(`reproduces DINDHR: day=${idynt === 1}, class=${istab}, mix=${amix}m, U=${u}m/s -> ${expected}`, () => {
      const di = atmosphericDispersionIndex(idynt === 1, istab, amix, u);
      expect(di).toBeCloseTo(expected, 2);
    });
  }

  it('is directly proportional to transport wind above the 1 m/s floor', () => {
    const base = atmosphericDispersionIndex(true, 3, 1200, 2);
    const doubled = atmosphericDispersionIndex(true, 3, 1200, 4);
    expect(doubled / base).toBeCloseTo(2, 5);
  });
});

describe('netRadiationIndex — Lavdas (1986) Appendix A', () => {
  it('pins NRI to 0 for overcast with low ceiling, day or night', () => {
    expect(netRadiationIndex(true, 50, 10, 5000)).toBe(0);
    expect(netRadiationIndex(false, -10, 10, 5000)).toBe(0);
  });

  it('night: -2 for mostly clear, -1 for mostly cloudy', () => {
    expect(netRadiationIndex(false, -10, 2, Infinity)).toBe(-2);
    expect(netRadiationIndex(false, -10, 7, Infinity)).toBe(-1);
  });

  it('day, mostly clear: NRI equals insolation class from solar elevation', () => {
    expect(netRadiationIndex(true, 65, 3, Infinity)).toBe(4);
    expect(netRadiationIndex(true, 45, 3, Infinity)).toBe(3);
    expect(netRadiationIndex(true, 25, 3, Infinity)).toBe(2);
    expect(netRadiationIndex(true, 10, 3, Infinity)).toBe(1);
  });

  it('day, cloudy: reduces insolation class by ceiling height', () => {
    expect(netRadiationIndex(true, 65, 8, 5000)).toBe(2);   // -2 low ceiling
    expect(netRadiationIndex(true, 65, 8, 10000)).toBe(3);  // -1 mid ceiling
    expect(netRadiationIndex(true, 65, 10, 20000)).toBe(3); // -1 total overcast, high ceiling
    expect(netRadiationIndex(true, 10, 8, 5000)).toBe(1);   // floors at 1
  });
});

describe('stabilityClass — Turner (1964) Table 2', () => {
  it('matches published table corners and interior', () => {
    expect(stabilityClass(4, 1)).toBe(1);   // strong sun, calm -> very unstable
    expect(stabilityClass(-2, 1)).toBe(7);  // clear night, calm -> very stable
    expect(stabilityClass(-2, 12)).toBe(4); // windy night -> neutral
    expect(stabilityClass(4, 12)).toBe(3);  // strong sun, windy
    expect(stabilityClass(0, 5)).toBe(4);   // NRI 0 is always neutral
    expect(stabilityClass(2, 6)).toBe(3);
    expect(stabilityClass(-1, 8)).toBe(4);
    expect(stabilityClass(1, 3)).toBe(3);
  });
});

describe('solarElevationDeg', () => {
  it('is high at local solar noon in a Mississippi summer, negative at midnight', () => {
    // Jackson, MS: local solar noon ~18:05 UTC in July; summer sun near 79 deg
    const noon = solarElevationDeg(new Date('2026-07-02T18:05:00Z'), 32.3, -90.18);
    expect(noon).toBeGreaterThan(75);
    expect(noon).toBeLessThan(85);
    const midnight = solarElevationDeg(new Date('2026-07-02T07:00:00Z'), 32.3, -90.18);
    expect(midnight).toBeLessThan(-25);
  });

  it('is near zero at sunrise', () => {
    // NOAA sunrise for Jackson MS on 2026-07-02 is ~11:00 UTC
    const sunrise = solarElevationDeg(new Date('2026-07-02T11:00:00Z'), 32.3, -90.18);
    expect(Math.abs(sunrise)).toBeLessThan(3);
  });
});

describe('lvori — Lavdas & Achtemeier (1995), GTR SRS-103 Table 3', () => {
  it('matches published table values', () => {
    expect(lvori(50, 1)).toBe(2);    // dry air: low risk even with DI 1
    expect(lvori(50, 100)).toBe(1);  // dry + great dispersion
    expect(lvori(98, 1)).toBe(10);   // saturated + DI 1: maximum risk
    expect(lvori(98, 2)).toBe(10);
    expect(lvori(98, 12)).toBe(7);
    expect(lvori(96, 1)).toBe(9);
    expect(lvori(93, 5)).toBe(6);
    expect(lvori(90, 3)).toBe(6);
    expect(lvori(87, 20)).toBe(4);
    expect(lvori(81, 1)).toBe(6);
    expect(lvori(72, 50)).toBe(3);
    expect(lvori(66, 100)).toBe(1);
  });

  it('boundary handling: RH bins are inclusive of lower bound', () => {
    expect(lvori(55, 9)).toBe(2);  // 55-59 row, DI 9-10 col
    expect(lvori(54.9, 9)).toBe(2); // <55 row
    expect(lvori(95, 3)).toBe(8);  // 95-97 row, DI 3-4 col
  });
});

describe('lvoriGuidance — Wade & Mobley (GTR SRS-103) thresholds', () => {
  it('flags caution at 5-6 and danger at 7+', () => {
    expect(lvoriGuidance(4).level).toBe('ok');
    expect(lvoriGuidance(5).level).toBe('caution');
    expect(lvoriGuidance(6).level).toBe('caution');
    expect(lvoriGuidance(7).level).toBe('danger');
    expect(lvoriGuidance(10).level).toBe('danger');
  });
});

describe('adiCategory — GTR SRS-103 field-revised interpretation', () => {
  it('categorizes daytime values', () => {
    expect(adiCategory(75, true).label).toBe('Very Good');
    expect(adiCategory(55, true).label).toBe('Good');
    expect(adiCategory(45, true).label).toBe('Generally Good');
    expect(adiCategory(30, true).label).toBe('Fair');
    expect(adiCategory(10, true).label).toBe('Poor');
  });

  it('interprets night values on their own scale', () => {
    expect(adiCategory(12, false).label).toContain('Unusually Good');
    expect(adiCategory(2, false).label).toContain('Typical Night');
  });
});
