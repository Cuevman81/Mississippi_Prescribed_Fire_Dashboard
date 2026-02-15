// ============================================================
// Air Quality Index Utilities
// ============================================================

import { AQI_COLORS, AQI_TEXT_COLORS } from './constants';

/** Get AQI background color by category name */
export function getAQIColor(categoryName: string): string {
  return AQI_COLORS[categoryName] || '#6b7280';
}

/** Get AQI text color by category name */
export function getAQITextColor(categoryName: string): string {
  return AQI_TEXT_COLORS[categoryName] || '#000000';
}

/** Get AQI category name from number */
export function getAQICategoryName(num: number): string {
  switch (num) {
    case 1: return 'Good';
    case 2: return 'Moderate';
    case 3: return 'Unhealthy for Sensitive Groups';
    case 4: return 'Unhealthy';
    case 5: return 'Very Unhealthy';
    case 6: return 'Hazardous';
    default: return 'Unknown';
  }
}

/** Get AQI color from category number */
export function getAQIColorByNumber(num: number): string {
  return getAQIColor(getAQICategoryName(num));
}

/** Get AQI health recommendation */
export function getAQIRecommendation(categoryName: string): string {
  switch (categoryName) {
    case 'Good':
      return 'Air quality is satisfactory. Little or no risk to health.';
    case 'Moderate':
      return 'Air quality is acceptable. May be a concern for sensitive individuals.';
    case 'Unhealthy for Sensitive Groups':
      return 'Members of sensitive groups may experience health effects. General public is less likely.';
    case 'Unhealthy':
      return 'Everyone may begin to experience health effects. Sensitive groups may experience more serious effects.';
    case 'Very Unhealthy':
      return 'Health alert: everyone may experience more serious health effects.';
    case 'Hazardous':
      return 'Health emergency. The entire population is more likely to be affected.';
    default:
      return '';
  }
}

/** Determine if burning should be avoided based on AQI */
export function shouldAvoidBurning(aqi: number): { avoid: boolean; reason: string } {
  if (aqi > 150) {
    return { avoid: true, reason: 'AQI is Unhealthy or worse. Burning will further degrade air quality.' };
  }
  if (aqi > 100) {
    return { avoid: false, reason: 'AQI is Unhealthy for Sensitive Groups. Use caution and consider smoke impacts.' };
  }
  return { avoid: false, reason: '' };
}
