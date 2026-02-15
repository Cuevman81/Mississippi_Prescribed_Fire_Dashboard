import type { PrescriptionParams } from './types';

// Default prescription parameters
export const DEFAULT_PRESCRIPTION: PrescriptionParams = {
  humidityMin: 30,
  humidityMax: 55,
  windSpeedMin: 4,
  windSpeedMax: 15,
  tempMin: 40,
  tempMax: 80,
  minVentilationIndex: 20000,
  daysSinceRain: 3,
};

export const PRESCRIPTION_PRESETS: Record<string, PrescriptionParams> = {
  'Grassland / Fuel Model 1': {
    humidityMin: 25,
    humidityMax: 45,
    windSpeedMin: 4,
    windSpeedMax: 15,
    tempMin: 35,
    tempMax: 75,
    minVentilationIndex: 20000,
    daysSinceRain: 2,
  },
  'Pine Understory': {
    humidityMin: 30,
    humidityMax: 50,
    windSpeedMin: 3,
    windSpeedMax: 12,
    tempMin: 40,
    tempMax: 85,
    minVentilationIndex: 30000,
    daysSinceRain: 3,
  },
  'Site Prep / High Fuel': {
    humidityMin: 40,
    humidityMax: 60,
    windSpeedMin: 2,
    windSpeedMax: 10,
    tempMin: 40,
    tempMax: 90,
    minVentilationIndex: 40000,
    daysSinceRain: 5,
  },
  'Default': DEFAULT_PRESCRIPTION,
};

// Burn quality thresholds
export const BURN_QUALITY = {
  EXCELLENT: { min: 90, label: 'Excellent', color: '#16a34a' },
  GOOD: { min: 70, label: 'Good', color: '#22c55e' },
  FAIR: { min: 50, label: 'Fair', color: '#eab308' },
  MARGINAL: { min: 30, label: 'Marginal', color: '#f97316' },
  POOR: { min: 0, label: 'Poor', color: '#dc2626' },
} as const;

export function getBurnQualityColor(score: number): string {
  if (score >= 90) return BURN_QUALITY.EXCELLENT.color;
  if (score >= 70) return BURN_QUALITY.GOOD.color;
  if (score >= 50) return BURN_QUALITY.FAIR.color;
  if (score >= 30) return BURN_QUALITY.MARGINAL.color;
  return BURN_QUALITY.POOR.color;
}

export function getBurnQualityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Marginal';
  return 'Poor';
}

// Dispersion category thresholds
export const DISPERSION = {
  EXCELLENT: { min: 60000, label: 'Excellent', color: '#16a34a', description: 'Rapid smoke dispersal expected. Excellent conditions for burning.' },
  GOOD: { min: 40000, label: 'Good', color: '#22c55e', description: 'Good smoke dispersal. Favorable conditions for prescribed burning.' },
  FAIR: { min: 20000, label: 'Fair', color: '#eab308', description: 'Moderate dispersion. Monitor smoke carefully during burn operations.' },
  POOR: { min: 10000, label: 'Poor', color: '#f97316', description: 'Limited smoke dispersal. Consider postponing burn operations.' },
  VERY_POOR: { min: 0, label: 'Very Poor', color: '#dc2626', description: 'Smoke trapping likely. Do NOT burn under these conditions.' },
} as const;

export function getDispersionColor(category: string): string {
  switch (category) {
    case 'Excellent': return DISPERSION.EXCELLENT.color;
    case 'Good': return DISPERSION.GOOD.color;
    case 'Fair': return DISPERSION.FAIR.color;
    case 'Poor': return DISPERSION.POOR.color;
    case 'Very Poor': return DISPERSION.VERY_POOR.color;
    default: return '#6b7280';
  }
}

// AQI category colors (EPA standard)
export const AQI_COLORS: Record<string, string> = {
  'Good': '#00e400',
  'Moderate': '#ffff00',
  'Unhealthy for Sensitive Groups': '#ff7e00',
  'USG': '#ff7e00',
  'Unhealthy': '#ff0000',
  'Very Unhealthy': '#8f3f97',
  'Hazardous': '#7e0023',
};

export const AQI_TEXT_COLORS: Record<string, string> = {
  'Good': '#000000',
  'Moderate': '#000000',
  'Unhealthy for Sensitive Groups': '#000000',
  'USG': '#000000',
  'Unhealthy': '#ffffff',
  'Very Unhealthy': '#ffffff',
  'Hazardous': '#ffffff',
};

// Drought Monitor colors
export const DROUGHT_COLORS: Record<number, { label: string; color: string }> = {
  0: { label: 'D0 - Abnormally Dry', color: '#FFFF00' },
  1: { label: 'D1 - Moderate Drought', color: '#FCD37F' },
  2: { label: 'D2 - Severe Drought', color: '#FFAA00' },
  3: { label: 'D3 - Extreme Drought', color: '#E60000' },
  4: { label: 'D4 - Exceptional Drought', color: '#730000' },
};

// HMS smoke density colors
export const SMOKE_COLORS: Record<string, string> = {
  'Light': '#D3D3D3',
  'Medium': '#808080',
  'Heavy': '#2B2B2B',
  'Unknown': '#A0A0A0',
};

// MFC Permit dispersion quality colors
export const PERMIT_DISPERSION_COLORS: Record<string, string> = {
  'Poor (Trapping)': '#FF9999',
  'Fair': '#FFFF99',
  'Good (Clearing)': '#99FF99',
};

// 16-point compass directions
export const COMPASS_DIRECTIONS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

// Sidebar navigation items
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
  { label: 'Forecast', href: '/forecast', icon: 'CloudSun' },
  { label: 'Burn Windows', href: '/burn-windows', icon: 'Clock' },
  { label: 'Air Quality', href: '/air-quality', icon: 'Wind' },
  { label: 'Fire & Smoke', href: '/fire-smoke', icon: 'Flame' },
  { label: 'Permits', href: '/permits', icon: 'FileText' },
  { label: 'Drought', href: '/drought', icon: 'Droplets' },
  { label: 'Safety', href: '/safety', icon: 'ShieldCheck' },
] as const;

// FFMC risk thresholds
export const FFMC_THRESHOLDS = {
  EXTREME: 92,
  VERY_HIGH: 89,
  HIGH: 85,
} as const;

// Mississippi bounding box (for AirNow state monitor queries)
export const MS_BBOX = {
  minLon: -91.655,
  minLat: 30.174,
  maxLon: -88.098,
  maxLat: 34.996,
};
