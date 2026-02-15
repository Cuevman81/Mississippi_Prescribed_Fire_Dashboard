// ============================================================
// Core Data Types for Prescribed Fire Weather Dashboard
// ============================================================

// --- Forecast & Weather ---

export interface HourlyForecast {
  time: string; // ISO string
  localTime: string;
  temp: number; // °F
  humidity: number; // %
  windSpeed: number; // mph
  windGust: number; // mph
  windDirection: number; // degrees
  windDirectionCardinal: string;
  skyCover: number; // %
  skyCoverAbbr: string;
  weatherCode: string;
  weatherAbbr: string;
  mixingHeight: number; // ft
  transportWindSpeed: number; // mph
  transportWindSpeedMs: number; // m/s
  transportWindDirection: number; // degrees
  transportWindDirectionCardinal: string;
  hainesIndex: number;
  precipChance: number; // %
  ventilationIndex: number;
  kbdiTrend: number;
  ffmc: number;
  fuelMoisture1hr: number; // %
  fuelMoisture10hr: number; // %
  fuelMoisture100hr: number; // %
  dispersionCategory: string;
  dispersionDescription: string;
  adjustedVI: number;
  burnQuality: string;
  burnScore: number;
  ignitionProbability: number; // %
}

export interface ForecastResult {
  forecast: HourlyForecast[];
  nwsOffice: string;
  narrativeForecast: NarrativePeriod[];
  fireDiscussion: string;
  zoneForecast: string;
  timezone: string;
  gridDataUrl: string;
}

export interface NarrativePeriod {
  name: string;
  detailedForecast: string;
  shortForecast: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  isDaytime: boolean;
}

export interface PointMetadata {
  cwa: string;
  forecastGridData: string;
  timeZone: string;
  forecastUrl: string;
  county: string;
  state: string;
}

// --- Real-time Station Data ---

export interface StationObservation {
  stationId: string;
  stationName: string;
  lat: number;
  lon: number;
  temp: number; // °F
  humidity: number; // %
  windSpeed: number; // mph
  windDirection: number;
  windDirectionCardinal: string;
  windGust: number; // mph
  visibility: number; // miles
  time: string;
  distanceMiles: number;
}

export interface WeatherStation {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
}

// --- Alerts ---

export interface AlertInfo {
  event: string;
  headline: string;
  description: string;
  severity: string;
  onset: string;
  expires: string;
}

// --- Air Quality ---

export interface AQIObservation {
  dateObserved: string;
  hourObserved: number;
  localTimeZone: string;
  reportingArea: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  parameterName: string;
  aqi: number;
  category: AQICategory;
}

export interface AQICategory {
  number: number;
  name: string;
}

export interface AQIForecast {
  dateIssue: string;
  dateForecast: string;
  reportingArea: string;
  stateCode: string;
  latitude: number;
  longitude: number;
  parameterName: string;
  aqi: number;
  category: AQICategory;
  actionDay: boolean;
  discussion: string;
}

export interface AQIMonitor {
  latitude: number;
  longitude: number;
  utc: string;
  parameter: string;
  aqi: number;
  category: number;
  siteName: string;
}

// --- HMS Fire & Smoke ---

export interface HMSFirePoint {
  lat: number;
  lon: number;
  satellite: string;
  method: string;
  frp: number; // Fire Radiative Power (MW)
  time: string;
}

export interface HMSSmokePolygon {
  geometry: GeoJSON.Geometry;
  density: string; // Light, Medium, Heavy
  satellite: string;
  start: string;
  end: string;
}

export interface HMSData {
  fires: HMSFirePoint[];
  smoke: GeoJSON.FeatureCollection | null;
  date: string;
}

// --- MFC Permits ---

export interface MFCPermit {
  objectId: number;
  permitDate: string;
  county: string;
  windDirection: string;
  windSpeed: number;
  mixingHeight: number;
  burnAcresEstimate: number;
  longitude: number;
  latitude: number;
  ventilationIndex: number;
  dispersionQuality: string;
  windDeg: number | null;
  year: number;
  burnPurpose?: string;
}

export interface PermitStats {
  totalPermits: number;
  totalAcres: number;
  todayPermits: number;
  todayAcres: number;
  avgVentilationIndex: number;
}

// --- Drought ---

export interface DroughtFeature {
  dm: number; // 0-4
  label: string;
  geometry: GeoJSON.Geometry;
}

// --- Burn Windows ---

export interface BurnWindow {
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  avgTemp: number;
  avgHumidity: number;
  avgWindSpeed: number;
  avgVentilationIndex: number;
  prevailingSurfaceWind: string;
  prevailingTransportWind: string;
  dispersionCategory: string;
  burnQuality: string;
  avgBurnScore: number;
}

// --- Prescription Parameters ---

export interface PrescriptionParams {
  humidityMin: number;
  humidityMax: number;
  windSpeedMin: number;
  windSpeedMax: number;
  tempMin: number;
  tempMax: number;
  minVentilationIndex: number;
  daysSinceRain: number;
}

// --- Burn Restrictions ---

export interface BurnRestrictions {
  status: 'clear' | 'advisory' | 'restricted';
  message: string;
  permitRequired: boolean;
  links: { label: string; url: string }[];
}

// --- Geocoding ---

export interface GeocodedLocation {
  lat: number;
  lon: number;
  displayName: string;
  city: string;
  state: string;
  stateAbbr: string;
}

// --- Fuel Moisture ---

export interface FuelMoisture {
  oneHour: number;
  tenHour: number;
  hundredHour: number;
}

// --- Dispersion Result ---

export interface DispersionResult {
  category: string;
  description: string;
  adjustedVI: number;
}

// --- Burn Assessment ---

export interface BurnAssessment {
  quality: string;
  score: number;
}
