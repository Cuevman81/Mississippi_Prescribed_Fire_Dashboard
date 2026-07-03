// ============================================================
// Atmospheric Dispersion Science
//
// Implements, from primary published sources:
//
//  1. Solar elevation angle (NOAA solar position, simplified Meeus)
//  2. Turner (1964) stability class via Net Radiation Index
//     — as specified in Lavdas (1986), Appendix A
//  3. Lavdas Atmospheric Dispersion Index (ADI)
//     — exact port of Lavdas, L.G. (1986) "An Atmospheric
//       Dispersion Index for Prescribed Burning", USDA Forest
//       Service Research Paper SE-256, eq. 14 and Appendix C.
//       Validated against all 27 published test vectors (Table 5).
//  4. LVORI — Low Visibility Occurrence Risk Index
//     — Lavdas & Achtemeier (1995); table as published in
//       Wade & Mobley, USDA Forest Service GTR SRS-103, Table 3.
// ============================================================

// ---------- Solar elevation ----------

/**
 * Solar elevation angle in degrees for a given UTC time and location.
 * NOAA/Meeus simplified algorithm; accurate to ~0.1 degree, far better
 * than the 15/35/60-degree insolation class boundaries require.
 */
export function solarElevationDeg(date: Date, lat: number, lon: number): number {
  const rad = Math.PI / 180;
  // Julian day from Unix epoch
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360; // mean longitude
  const g = ((357.528 + 0.9856003 * n) % 360) * rad; // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad; // ecliptic longitude
  const epsilon = (23.439 - 0.0000004 * n) * rad; // obliquity

  const sinDec = Math.sin(epsilon) * Math.sin(lambda);
  const dec = Math.asin(sinDec); // declination
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)); // right ascension

  // Greenwich mean sidereal time (degrees)
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const lst = (gmst + lon) * rad; // local sidereal time
  const ha = lst - ra; // hour angle

  const sinElev =
    Math.sin(lat * rad) * Math.sin(dec) +
    Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinElev))) / rad;
}

// ---------- Turner stability class (Lavdas 1986, Appendix A) ----------

/**
 * Net Radiation Index per Lavdas (1986) Appendix A / Turner (1964).
 * @param isDay solar elevation > 0
 * @param solarElevDeg solar elevation angle (degrees)
 * @param cloudCoverTenths total opaque cloud cover, 0-10
 * @param ceilingFt cloud ceiling in feet; Infinity when undefined/clear
 */
export function netRadiationIndex(
  isDay: boolean,
  solarElevDeg: number,
  cloudCoverTenths: number,
  ceilingFt: number
): number {
  // Rule I: overcast with low ceiling pins NRI to 0, day or night
  if (cloudCoverTenths >= 10 && ceilingFt < 7000) return 0;

  if (!isDay) {
    return cloudCoverTenths <= 4 ? -2 : -1;
  }

  // Insolation class from solar elevation
  let ic: number;
  if (solarElevDeg > 60) ic = 4;
  else if (solarElevDeg > 35) ic = 3;
  else if (solarElevDeg > 15) ic = 2;
  else ic = 1;

  if (cloudCoverTenths <= 5) return ic;

  // Cloud modifications
  let modified = ic;
  if (ceilingFt < 7000) modified -= 2;
  else if (ceilingFt < 16000) modified -= 1;
  else if (cloudCoverTenths >= 10) modified -= 1;

  return Math.max(1, modified);
}

// Table 2, Lavdas (1986): stability class from NRI (columns 4..-2) and
// surface wind speed in knots (rows)
const STABILITY_TABLE: number[][] = [
  // NRI:      4  3  2  1  0 -1 -2
  /* 0-1 kt */ [1, 1, 2, 3, 4, 6, 7],
  /* 2    */   [1, 2, 2, 3, 4, 6, 7],
  /* 3    */   [1, 2, 2, 3, 4, 6, 7],
  /* 4    */   [1, 2, 3, 4, 4, 5, 6],
  /* 5    */   [1, 2, 3, 4, 4, 5, 6],
  /* 6    */   [2, 2, 3, 4, 4, 5, 6],
  /* 7    */   [2, 2, 3, 4, 4, 4, 5],
  /* 8    */   [2, 3, 3, 4, 4, 4, 5],
  /* 9    */   [2, 3, 3, 4, 4, 4, 5],
  /* 10   */   [3, 3, 4, 4, 4, 4, 5],
  /* 11   */   [3, 3, 4, 4, 4, 4, 4],
  /* >=12 */   [3, 4, 4, 4, 4, 4, 4],
];

/** Turner stability class 1 (very unstable) .. 7 (very stable). */
export function stabilityClass(nri: number, windKnots: number): number {
  const col = 4 - Math.max(-2, Math.min(4, Math.round(nri))); // NRI 4 -> col 0
  const kt = Math.round(windKnots);
  const row = kt <= 1 ? 0 : Math.min(kt - 1, 11);
  return STABILITY_TABLE[row][col];
}

// ---------- Lavdas (1986) Atmospheric Dispersion Index ----------

const SQRT_2PI = Math.sqrt(2 * Math.PI);

interface SigmaCoeffs {
  // a, b for the three downwind ranges: 100-500 m, 500-5000 m, >5000 m
  ranges: Array<{ a: number; b: number }>;
  xv: number; // virtual distance for initial sigma-z of 30 m
}

// Appendix C, Table 3 (Lavdas 1986)
const COEFFS: Record<string, SigmaCoeffs> = {
  '1': {
    ranges: [
      { a: 0.0383, b: 1.2812 },
      { a: 0.0002539, b: 2.0886 },
      { a: 0.0002539, b: 2.0886 },
    ],
    xv: 181.46,
  },
  '2': {
    ranges: [
      { a: 0.1393, b: 0.9467 },
      { a: 0.04936, b: 1.1137 },
      { a: 0.04936, b: 1.1137 },
    ],
    xv: 291.43,
  },
  '3': {
    ranges: [
      { a: 0.112, b: 0.91 },
      { a: 0.1014, b: 0.926 },
      { a: 0.1154, b: 0.9109 },
    ],
    xv: 465.62,
  },
  '4day': {
    ranges: [
      { a: 0.0856, b: 0.865 },
      { a: 0.0856, b: 0.865 },
      { a: 0.0856, b: 0.865 },
    ],
    xv: 874.56,
  },
  '4night': {
    ranges: [
      { a: 0.0856, b: 0.865 },
      { a: 0.2591, b: 0.6869 },
      { a: 0.7368, b: 0.5642 },
    ],
    xv: 1010.0,
  },
  '5': {
    ranges: [
      { a: 0.0818, b: 0.8155 },
      { a: 0.2527, b: 0.6341 },
      { a: 1.2969, b: 0.4421 },
    ],
    xv: 1869.0,
  },
  '67': {
    ranges: [
      { a: 0.0545, b: 0.8124 },
      { a: 0.2017, b: 0.602 },
      { a: 1.5763, b: 0.3606 },
    ],
    xv: 4061.3,
  },
};

const RANGE_BOUNDS: Array<[number, number]> = [
  [100, 500],
  [500, 5000],
  [5000, Infinity],
];

// Maximum effective mixing height: box-model sigma-z (2/sqrt(2pi))*H
// must not exceed 5,000 m (eq. 4)
const H_MAX = (5000 * SQRT_2PI) / 2; // ~6266.6 m — the "6267" on the paper's chart

/**
 * Lavdas (1986) Atmospheric Dispersion Index. Exact port of the
 * DSPNHR FORTRAN package (Appendix E), validated against all 27
 * published test vectors in Table 5 of the paper.
 *
 * @param isDay        daylight hours (sunrise to sunset)
 * @param stability    Turner stability class 1-7
 * @param mixingHeightM mixing height in meters
 * @param transportWindMs transport wind speed in m/s
 */
export function atmosphericDispersionIndex(
  isDay: boolean,
  stability: number,
  mixingHeightM: number,
  transportWindMs: number
): number {
  const key =
    stability <= 3 ? String(stability)
    : stability === 4 ? (isDay ? '4day' : '4night')
    : stability === 5 ? '5'
    : '67';
  const { ranges, xv } = COEFFS[key];

  // Minimum recommended transport wind 1 m/s (Turner and Novak 1978)
  const W = Math.max(transportWindMs, 1.0);

  // Effective mixing height (eqs. 20-23 and Appendix D):
  // stable classes use fixed smoke-layer depths instead of mixing height
  let H: number;
  if (stability === 5) H = 180;
  else if (stability >= 6) H = 150;
  else if (stability === 4 && !isDay) H = Math.min(Math.max(mixingHeightM, 240), 600);
  else H = Math.max(mixingHeightM, 240);
  H = Math.min(H, H_MAX);

  // Critical distance x_c where sigma-z reaches the box-model value
  // (eq. 32). Stable classes: x_c always exceeds the area, never used.
  let Av: number;
  if (stability >= 5) {
    Av = 50000 + xv;
  } else {
    // x_c from eq. (6): a*x_c^b = (2/sqrt(2pi))*H. (Eq. 32 as printed
    // reads sqrt(2pi)H/2a, a typesetting error — the paper's own
    // class-3 crossover statement, x_c = 5000 m at H = 338.5 m, and
    // its Table 5 test vectors confirm this form.)
    // For class 3 with H < 338.5 m, x_c falls in the 500-5000 m range
    const cIdx = key === '3' && H < 338.5 ? 1 : 2;
    const { a, b } = ranges[cIdx];
    const xc = Math.pow((2 * H) / (SQRT_2PI * a), 1 / b);
    Av = Math.min(50000 + xv, xc);
  }

  // Series term (eq. 14): integral of 1/(a x^b) over [xv, Av],
  // piecewise across the three coefficient ranges
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const [lo, hi] = RANGE_BOUNDS[i];
    const xR = Math.max(lo, xv);
    const AR = Math.min(hi, Av);
    if (xR < Av && AR > xv && AR > xR) {
      const { a, b } = ranges[i];
      const p = 1 - b;
      sum += (Math.pow(AR, p) - Math.pow(xR, p)) / (a * p);
    }
  }

  const inverse =
    50 / (H * W) +
    (0.002 / (SQRT_2PI * W)) * sum +
    (0.001 * (50000 + xv - Av)) / (H * W);

  return 1 / inverse;
}

/**
 * Field-revised daytime ADI interpretation, per Wade & Mobley,
 * USDA Forest Service GTR SRS-103, Table 1. Note: nighttime values
 * are interpreted differently (a nighttime ADI of 12 is unusually
 * good dispersion; the same daytime value is poor).
 */
export function adiCategory(adi: number, isDay: boolean): { label: string; guidance: string } {
  if (!isDay) {
    if (adi >= 12) return { label: 'Unusually Good (night)', guidance: 'Nighttime dispersion well above typical.' };
    if (adi >= 7) return { label: 'Above Average (night)', guidance: 'Better than average nighttime dispersion.' };
    return { label: 'Typical Night (poor)', guidance: 'Stable nighttime air; residual smoke will pool and drain into low areas.' };
  }
  if (adi >= 70) return { label: 'Very Good', guidance: 'Dispersion so strong that fire control (spotting) becomes the concern.' };
  if (adi >= 50) return { label: 'Good', guidance: 'Preferred range for prescription burns.' };
  if (adi >= 41) return { label: 'Generally Good', guidance: 'Acceptable, especially for burns under 50 acres.' };
  if (adi >= 21) return { label: 'Fair', guidance: 'Possible stagnation with low winds. Reassess for heavy fuels or larger units.' };
  return { label: 'Poor', guidance: 'Below the commonly accepted daytime burning threshold (ADI 40+ preferred, <21 poor).' };
}

// ---------- LVORI (Lavdas & Achtemeier 1995) ----------

// Column bins are Dispersion Index ranges, ascending:
// 1, 2, 3-4, 5-6, 7-8, 9-10, 11-12, 13-16, 17-25, 26-30, 31-40, >40
const LVORI_DI_BREAKS = [1, 2, 4, 6, 8, 10, 12, 16, 25, 30, 40, Infinity];

// Rows are RH bins: <55, 55-59, 60-64, 65-69, 70-74, 75-79, 80-82,
// 83-85, 86-88, 89-91, 92-94, 95-97, >97
// Values transcribed from USDA GTR SRS-103 Table 3 (text source),
// cross-checked against the NWS ADI/LVORI guide.
const LVORI_TABLE: number[][] = [
  //DI: 1   2  3-4 5-6 7-8 9-10 11-12 13-16 17-25 26-30 31-40 >40
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1],       // RH < 55
  [3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1],       // 55-59
  [3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1],       // 60-64
  [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],       // 65-69
  [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],       // 70-74
  [4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3],       // 75-79
  [6, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3],       // 80-82
  [6, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4],       // 83-85
  [6, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4],       // 86-88
  [7, 7, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4],       // 89-91
  [8, 7, 6, 6, 6, 6, 5, 5, 5, 4, 4, 4],       // 92-94
  [9, 8, 8, 7, 6, 6, 6, 5, 5, 4, 4, 4],       // 95-97
  [10, 10, 9, 9, 8, 8, 7, 5, 5, 4, 4, 4],     // > 97
];

const LVORI_RH_BREAKS = [55, 60, 65, 70, 75, 80, 83, 86, 89, 92, 95, 98, Infinity];

/**
 * Low Visibility Occurrence Risk Index (1-10): relative likelihood of a
 * smoke/fog-related low-visibility event, from relative humidity and the
 * Lavdas Dispersion Index. Most relevant at night and for residual
 * (smoldering) smoke.
 */
export function lvori(relativeHumidity: number, adi: number): number {
  let row = 0;
  while (relativeHumidity >= LVORI_RH_BREAKS[row]) row++;
  let col = 0;
  const di = Math.max(1, Math.round(adi));
  while (di > LVORI_DI_BREAKS[col]) col++;
  return LVORI_TABLE[row][col];
}

/**
 * Operational guidance thresholds from Wade & Mobley (GTR SRS-103):
 * use caution at LVORI >= 5; do not burn at LVORI >= 7 unless the fire
 * is completely mopped up by dusk.
 */
export function lvoriGuidance(value: number): { level: 'ok' | 'caution' | 'danger'; text: string } {
  if (value >= 7) {
    return {
      level: 'danger',
      text: 'High risk of smoke/fog visibility hazards on roads. Do not burn unless fully mopped up (no smokes) by dusk.',
    };
  }
  if (value >= 5) {
    return {
      level: 'caution',
      text: 'Elevated risk of nighttime visibility problems from residual smoke. Use caution; plan complete mop-up.',
    };
  }
  return { level: 'ok', text: 'Low likelihood of smoke/fog visibility problems.' };
}
