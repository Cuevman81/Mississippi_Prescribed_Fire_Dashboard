// ============================================================
// Fire Science Calculations
// Ported from Prescribed_Burning_APP.R
// ============================================================

import type { FuelMoisture, DispersionResult, BurnAssessment } from './types';

/**
 * Calculate KBDI Trend (Keetch-Byram Drought Index - simplified)
 * Indicates long-term drought (0-800 scale)
 */
export function calculateKBDITrend(temp: number, humidity: number): number {
  return (100 - humidity) * 2 + (temp - 60) * 0.5;
}

/**
 * Calculate Fine Fuel Moisture Code (FFMC)
 * Estimates moisture in 1-hour fuel timelag class (0-100 scale)
 * >92: Extreme ignition potential
 * 89-91: Very High
 * 85-88: High
 */
export function calculateFFMC(temp: number, humidity: number, windSpeed: number): number {
  const ffmc = 85 + (temp - 60) * 0.3 - (humidity - 45) * 0.5 + windSpeed * 0.1;
  return Math.max(0, Math.min(100, ffmc));
}

/**
 * Calculate fuel moisture for 1-hour, 10-hour, and 100-hour timelag classes
 * Uses Simard (1968) Equilibrium Moisture Content (EMC) equation
 */
export function calculateFuelMoisture(
  temp: number,
  humidity: number,
  daysSinceRain: number
): FuelMoisture {
  // Simard EMC calculation with three humidity branches
  let emc: number;
  if (humidity <= 10) {
    emc = 0.03229 + 0.281073 * humidity - 0.000578 * humidity * temp;
  } else if (humidity <= 50) {
    emc = 2.22749 + 0.160107 * humidity - 0.01478 * temp;
  } else {
    emc = 21.0606 + 0.005565 * humidity * humidity - 0.00035 * humidity * temp - 0.483199 * humidity;
  }

  // 1-hour fuel moisture = EMC directly
  const oneHour = Math.max(1, Math.min(35, emc));

  // 10-hour: decay factor 0.8 simulates drying from initial saturation
  const tenHour = Math.max(1, Math.min(35, emc + (25 - emc) * Math.pow(0.8, daysSinceRain)));

  // 100-hour: slower decay (0.95) for larger diameter fuels
  const hundredHour = Math.max(1, Math.min(35, emc + (40 - emc) * Math.pow(0.95, daysSinceRain)));

  return { oneHour, tenHour, hundredHour };
}

/**
 * Calculate ignition probability based on NFDRS
 */
export function calculateIgnitionProbability(
  _temp: number,
  _humidity: number,
  fuelMoisture1hr: number
): number {
  const prob = 100 - fuelMoisture1hr * 2.5;
  return Math.max(0, Math.min(100, prob));
}

/**
 * Determine smoke dispersion category based on ventilation index
 * Applies stability adjustment based on time of day
 */
export function determineDispersionCategory(
  mixingHeightFt: number,
  transportWindMph: number,
  timeOfDay: number // hour 0-23
): DispersionResult {
  const vi = mixingHeightFt * transportWindMph;

  // Stability adjustment based on time of day
  let stabilityFactor: number;
  if (timeOfDay >= 10 && timeOfDay <= 15) {
    stabilityFactor = 1.0; // Most unstable (afternoon)
  } else if ((timeOfDay >= 7 && timeOfDay < 10) || (timeOfDay > 15 && timeOfDay <= 18)) {
    stabilityFactor = 0.8; // Transition periods
  } else {
    stabilityFactor = 0.5; // Most stable (night)
  }

  const adjustedVI = vi * stabilityFactor;

  let category: string;
  let description: string;

  if (adjustedVI >= 60000) {
    category = 'Excellent';
    description = 'Rapid smoke dispersal expected. Excellent conditions for burning.';
  } else if (adjustedVI >= 40000) {
    category = 'Good';
    description = 'Good smoke dispersal. Favorable conditions for prescribed burning.';
  } else if (adjustedVI >= 20000) {
    category = 'Fair';
    description = 'Moderate dispersion. Monitor smoke carefully during burn operations.';
  } else if (adjustedVI >= 10000) {
    category = 'Poor';
    description = 'Limited smoke dispersal. Consider postponing burn operations.';
  } else {
    category = 'Very Poor';
    description = 'Smoke trapping likely. Do NOT burn under these conditions.';
  }

  return { category, description, adjustedVI: Math.round(adjustedVI) };
}

/**
 * Assess burn window quality with composite scoring (0-100)
 * Temperature: 0-25 pts, Humidity: 0-25 pts, Wind: 0-25 pts, VI: 0-25 pts
 */
export function assessBurnWindow(
  temp: number,
  humidity: number,
  windSpeed: number,
  windGust: number,
  mixingHeightFt: number,
  ventilationIndex: number
): BurnAssessment {
  // Temperature score (0-25): ideal 40-80°F
  let tempScore: number;
  if (temp >= 40 && temp <= 80) {
    tempScore = 25;
  } else if (temp >= 30 && temp < 40) {
    tempScore = 25 - (40 - temp) * 2.5;
  } else if (temp > 80 && temp <= 90) {
    tempScore = 25 - (temp - 80) * 2.5;
  } else {
    tempScore = 0;
  }

  // Humidity score (0-25): ideal 30-55%
  let humidityScore: number;
  if (humidity >= 30 && humidity <= 55) {
    humidityScore = 25;
  } else if (humidity >= 20 && humidity < 30) {
    humidityScore = 25 - (30 - humidity) * 2.5;
  } else if (humidity > 55 && humidity <= 65) {
    humidityScore = 25 - (humidity - 55) * 2.5;
  } else {
    humidityScore = 0;
  }

  // Wind score (0-25): ideal 4-15 mph, reduced if gusts >25
  let windScore: number;
  if (windSpeed >= 4 && windSpeed <= 15) {
    windScore = 25;
  } else if (windSpeed >= 2 && windSpeed < 4) {
    windScore = 25 - (4 - windSpeed) * 12.5;
  } else if (windSpeed > 15 && windSpeed <= 20) {
    windScore = 25 - (windSpeed - 15) * 5;
  } else {
    windScore = 0;
  }
  // Gust penalty
  if (windGust > 25) {
    windScore = Math.max(0, windScore - 15);
  }

  // Ventilation Index score (0-25): ideal >40,000
  let viScore: number;
  if (ventilationIndex >= 40000) {
    viScore = 25;
  } else if (ventilationIndex >= 20000) {
    viScore = 25 * ((ventilationIndex - 20000) / 20000);
  } else {
    viScore = 0;
  }

  // Also factor in mixing height — penalize if very low
  if (mixingHeightFt < 1500) {
    viScore = Math.max(0, viScore - 10);
  }

  const score = Math.round(Math.max(0, Math.min(100, tempScore + humidityScore + windScore + viScore)));

  let quality: string;
  if (score >= 90) quality = 'Excellent';
  else if (score >= 70) quality = 'Good';
  else if (score >= 50) quality = 'Fair';
  else if (score >= 30) quality = 'Marginal';
  else quality = 'Poor';

  return { quality, score };
}

/**
 * Calculate Ventilation Index
 */
export function calculateVentilationIndex(
  mixingHeightFt: number,
  transportWindMph: number
): number {
  return Math.round(mixingHeightFt * transportWindMph);
}
