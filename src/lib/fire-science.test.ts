import { describe, it, expect } from 'vitest';
import {
  calculateKBDITrend,
  calculateFFMC,
  calculateFuelMoisture,
  calculateIgnitionProbability,
  determineDispersionCategory,
  assessBurnWindow,
  calculateVentilationIndex,
} from './fire-science';

describe('calculateVentilationIndex', () => {
  it('multiplies mixing height (ft) by transport wind (mph)', () => {
    expect(calculateVentilationIndex(4000, 10)).toBe(40000);
    expect(calculateVentilationIndex(0, 10)).toBe(0);
  });

  // Known-answer regression test from live NWS data (grid JAN/76,63,
  // 2026-07-03T00:00Z): mixing height 675 ft, transport wind 6.9 mph.
  // The pre-fix knots interpretation produced 8,632 instead of 4,661.
  it('REGRESSION: matches independently verified live value', () => {
    expect(calculateVentilationIndex(675, 6.905)).toBe(4661);
  });
});

describe('determineDispersionCategory', () => {
  it('applies full mixing during afternoon hours (10-15 local)', () => {
    expect(determineDispersionCategory(6000, 10, 12).adjustedVI).toBe(60000);
    expect(determineDispersionCategory(6000, 10, 10).adjustedVI).toBe(60000);
    expect(determineDispersionCategory(6000, 10, 15).adjustedVI).toBe(60000);
  });

  it('applies 0.8 factor during morning/evening transitions', () => {
    expect(determineDispersionCategory(6000, 10, 8).adjustedVI).toBe(48000);
    expect(determineDispersionCategory(6000, 10, 17).adjustedVI).toBe(48000);
  });

  it('applies 0.5 factor at night (stable atmosphere)', () => {
    expect(determineDispersionCategory(6000, 10, 22).adjustedVI).toBe(30000);
    expect(determineDispersionCategory(6000, 10, 4).adjustedVI).toBe(30000);
  });

  it('categorizes adjusted VI into dispersion classes', () => {
    expect(determineDispersionCategory(6000, 10, 12).category).toBe('Excellent'); // 60k
    expect(determineDispersionCategory(4500, 10, 12).category).toBe('Good');      // 45k
    expect(determineDispersionCategory(2500, 10, 12).category).toBe('Fair');      // 25k
    expect(determineDispersionCategory(1500, 10, 12).category).toBe('Poor');      // 15k
    expect(determineDispersionCategory(500, 10, 12).category).toBe('Very Poor');  // 5k
  });

  it('warns against burning in Very Poor conditions', () => {
    expect(determineDispersionCategory(500, 10, 12).description).toContain('Do NOT burn');
  });
});

describe('assessBurnWindow', () => {
  it('scores ideal conditions as 100 / Excellent', () => {
    // temp 70 (40-80), RH 40 (30-55), wind 8 (4-15), gust 10, mix 3000, VI 45k
    const r = assessBurnWindow(70, 40, 8, 10, 3000, 45000);
    expect(r.score).toBe(100);
    expect(r.quality).toBe('Excellent');
  });

  it('penalizes gusts above 25 mph', () => {
    const calm = assessBurnWindow(70, 40, 8, 10, 3000, 45000);
    const gusty = assessBurnWindow(70, 40, 8, 30, 3000, 45000);
    expect(calm.score - gusty.score).toBe(15);
  });

  it('scales VI score between 20k and 40k', () => {
    const r = assessBurnWindow(70, 40, 8, 10, 3000, 30000);
    expect(r.score).toBe(88); // 75 + 25 * (10000/20000) = 87.5, rounded
  });

  it('penalizes very low mixing height', () => {
    const high = assessBurnWindow(70, 40, 8, 10, 3000, 45000);
    const low = assessBurnWindow(70, 40, 8, 10, 1000, 45000);
    expect(high.score - low.score).toBe(10);
  });

  it('scores hostile conditions as 0 / Poor', () => {
    const r = assessBurnWindow(95, 70, 25, 35, 500, 5000);
    expect(r.score).toBe(0);
    expect(r.quality).toBe('Poor');
  });

  it('maps score bands to quality labels', () => {
    expect(assessBurnWindow(70, 40, 8, 10, 3000, 45000).quality).toBe('Excellent'); // 100
    expect(assessBurnWindow(70, 40, 8, 30, 3000, 45000).quality).toBe('Good');      // 85
    expect(assessBurnWindow(70, 40, 2, 10, 3000, 20000).quality).toBe('Fair');      // 50
    expect(assessBurnWindow(70, 62, 2, 10, 3000, 20000).quality).toBe('Marginal');  // ~32
    expect(assessBurnWindow(95, 70, 25, 35, 500, 5000).quality).toBe('Poor');       // 0
  });
});

describe('calculateFuelMoisture (Simard EMC)', () => {
  it('uses the low-humidity branch (RH <= 10)', () => {
    // emc = 0.03229 + 0.281073*5 - 0.000578*5*70 = 1.2354
    const fm = calculateFuelMoisture(70, 5, 3);
    expect(fm.oneHour).toBeCloseTo(1.24, 1);
  });

  it('uses the mid-humidity branch (10 < RH <= 50)', () => {
    // emc = 2.22749 + 0.160107*30 - 0.01478*70 = 5.996
    const fm = calculateFuelMoisture(70, 30, 3);
    expect(fm.oneHour).toBeCloseTo(6.0, 1);
  });

  it('uses the high-humidity branch (RH > 50)', () => {
    // emc = 21.0606 + 0.005565*6400 - 0.00035*80*70 - 0.483199*80 = 16.06
    const fm = calculateFuelMoisture(70, 80, 3);
    expect(fm.oneHour).toBeCloseTo(16.06, 1);
  });

  it('clamps all values to the 1-35% range', () => {
    const dry = calculateFuelMoisture(110, 2, 60);
    expect(dry.oneHour).toBeGreaterThanOrEqual(1);
    const wet = calculateFuelMoisture(40, 100, 0);
    expect(wet.hundredHour).toBeLessThanOrEqual(35);
  });

  it('dries larger fuels toward EMC as days since rain increase', () => {
    const recent = calculateFuelMoisture(70, 30, 0);
    const dried = calculateFuelMoisture(70, 30, 30);
    expect(dried.tenHour).toBeLessThan(recent.tenHour);
    expect(dried.hundredHour).toBeLessThan(recent.hundredHour);
    // After a long dry spell, 10-hr fuels approach the 1-hr EMC
    expect(dried.tenHour).toBeCloseTo(dried.oneHour, 0);
  });
});

describe('calculateFFMC', () => {
  it('computes the simplified FFMC estimate', () => {
    // 85 + (70-60)*0.3 - (30-45)*0.5 + 10*0.1 = 96.5
    expect(calculateFFMC(70, 30, 10)).toBeCloseTo(96.5, 1);
  });

  it('clamps to the 0-100 range', () => {
    expect(calculateFFMC(200, 0, 100)).toBe(100);
    expect(calculateFFMC(-100, 100, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateIgnitionProbability', () => {
  it('decreases with fuel moisture and clamps to 0-100', () => {
    expect(calculateIgnitionProbability(70, 30, 10)).toBe(75);
    expect(calculateIgnitionProbability(70, 30, 45)).toBe(0);
    expect(calculateIgnitionProbability(70, 30, 0)).toBe(100);
  });
});

describe('calculateKBDITrend', () => {
  it('computes the drought trend estimate', () => {
    // (100-20)*2 + (95-60)*0.5 = 177.5
    expect(calculateKBDITrend(95, 20)).toBeCloseTo(177.5, 1);
  });
});
