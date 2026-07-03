'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  HourlyForecast,
  NarrativePeriod,
  StationObservation,
  AlertInfo,
  AQIObservation,
  AQIForecast,
  AQIMonitor,
  PrescriptionParams,
  GeocodedLocation,
} from './types';
import { DEFAULT_PRESCRIPTION } from './constants';
import {
  mphToMs,
  degreesToCardinal,
  getSkyCoverAbbr,
  getWeatherAbbr,
  expandNWSTimeSeries,
  expandNWSTimeSeriesToMap,
  convertNWSValue,
  parseISODuration,
} from './weather-utils';

interface GridSeries {
  values: Array<{ validTime: string; value: number }>;
  uom: string;
}

interface WeatherGridFields {
  temperature: GridSeries;
  relativeHumidity: GridSeries;
  windSpeed: GridSeries;
  windDirection: GridSeries;
  windGust: GridSeries;
  skyCover: GridSeries;
  weather: {
    values: Array<{
      validTime: string;
      value: Array<{
        weather?: string;
        [key: string]: unknown;
      }>;
    }>;
    uom: string;
  };
  mixingHeight: GridSeries;
  transportWindSpeed: GridSeries;
  transportWindDirection: GridSeries;
  hainesIndex: GridSeries;
  probabilityOfPrecipitation: GridSeries;
  ceilingHeight?: GridSeries;
}

interface WeatherMetadata {
  cwa: string;
  forecastGridData: string;
  timeZone: string;
  forecastUrl: string;
  county: string;
  state: string;
}
import {
  calculateFFWI,
  calculateFuelMoisture,
  calculateIgnitionProbability,
  determineDispersionCategory,
  assessBurnWindow,
  calculateVentilationIndex,
} from './fire-science';
import {
  solarElevationDeg,
  netRadiationIndex,
  stabilityClass,
  atmosphericDispersionIndex,
  adiCategory,
  lvori,
} from './dispersion';
import type { KBDIData } from './types';

interface DashboardState {
  // Location
  location: GeocodedLocation | null;
  isLoading: boolean;
  error: string | null;

  // Prescription
  prescription: PrescriptionParams;
  setPrescription: (p: PrescriptionParams) => void;

  // Weather data
  forecast: HourlyForecast[];
  currentForecastIdx: number; // index of the forecast hour closest to now
  narrativeForecast: NarrativePeriod[];
  nwsOffice: string;
  timezone: string;
  lastUpdated: string;

  // Alerts
  alerts: AlertInfo[];
  fireDiscussion: string;
  zoneForecast: string;
  burnBanInfo: string;

  // Station
  stationObservation: StationObservation | null;

  // Air quality
  currentAQI: AQIObservation[];
  aqiForecast: AQIForecast[];
  aqiMonitors: AQIMonitor[];

  // Drought (real KBDI computed from observed climate data)
  kbdi: KBDIData | null;

  // Actions
  fetchForecast: (locationQuery: string) => Promise<void>;
  fetchForecastByCoords: (lat: number, lon: number, displayName?: string) => Promise<void>;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<PrescriptionParams>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prfi_prescription');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved prescription', e);
        }
      }
    }
    return DEFAULT_PRESCRIPTION;
  });

  const [weatherGridData, setWeatherGridData] = useState<{
    metadata: WeatherMetadata;
    gridFields: WeatherGridFields;
    lat: number;
    lon: number;
  } | null>(null);
  const [kbdi, setKbdi] = useState<KBDIData | null>(null);
  const [narrativeForecast, setNarrativeForecast] = useState<NarrativePeriod[]>([]);
  const [nwsOffice, setNwsOffice] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');

  const [alerts, setAlerts] = useState<AlertInfo[]>([]);
  const [fireDiscussion, setFireDiscussion] = useState('');
  const [zoneForecast, setZoneForecast] = useState('');
  const [burnBanInfo, setBurnBanInfo] = useState('');

  const [stationObservation, setStationObservation] = useState<StationObservation | null>(null);

  const [currentAQI, setCurrentAQI] = useState<AQIObservation[]>([]);
  const [aqiForecast, setAqiForecast] = useState<AQIForecast[]>([]);
  const [aqiMonitors, setAqiMonitors] = useState<AQIMonitor[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Persist prescription anytime it changes
  React.useEffect(() => {
    localStorage.setItem('prfi_prescription', JSON.stringify(prescription));
  }, [prescription]);

  // Auto-refresh alerts every 5 minutes
  React.useEffect(() => {
    if (!location) return;

    const refreshAlerts = async () => {
      try {
        const alertsWithOffice = await fetch(
          `/api/alerts?lat=${location.lat}&lon=${location.lon}&office=${nwsOffice}`
        );
        if (alertsWithOffice.ok) {
          const alertData = await alertsWithOffice.json();
          setAlerts(alertData.alerts || []);
          setFireDiscussion(alertData.fireDiscussion || '');
          setZoneForecast(alertData.zoneForecast || '');
          setBurnBanInfo(alertData.burnBanInfo || '');
          setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
        }
      } catch (err) {
        console.error('Failed to auto-refresh alerts:', err);
      }
    };

    const interval = setInterval(refreshAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [location, nwsOffice]);

  const fetchForecastByCoords = useCallback(async (lat: number, lon: number, displayName?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let loc: GeocodedLocation;

      if (displayName) {
        // We already have geocoded data
        loc = {
          lat,
          lon,
          displayName,
          city: displayName.split(',')[0],
          state: '',
          stateAbbr: ''
        };
      } else {
        // Reverse geocode via local API
        const revRes = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
        const revData = await revRes.json();
        loc = {
          lat,
          lon,
          displayName: revData.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          city: revData.address?.city || revData.address?.town || revData.address?.village || '',
          state: revData.address?.state || '',
          stateAbbr: '',
        };
      }

      setLocation(loc);

      // Step 2: Fetch weather + alerts + air quality + drought in parallel
      const [weatherRes, aqCurrentRes, aqForecastRes, aqMonitorsRes, kbdiRes] = await Promise.all([
        fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`),
        fetch(`/api/air-quality?type=current&lat=${loc.lat}&lon=${loc.lon}`),
        fetch(`/api/air-quality?type=forecast&lat=${loc.lat}&lon=${loc.lon}`),
        fetch(`/api/air-quality?type=monitors`),
        fetch(`/api/kbdi?lat=${loc.lat}&lon=${loc.lon}`),
      ]);

      // Process weather data
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        const meta = weatherData.metadata;
        const grid = weatherData.gridFields;

        setNwsOffice(meta.cwa);
        setTimezone(meta.timeZone || 'America/Chicago');
        setWeatherGridData({ metadata: meta, gridFields: grid, lat: loc.lat, lon: loc.lon });

        const narr = (weatherData.narrativeForecast?.periods || weatherData.narrativePeriods || []).map((p: {
          name: string;
          detailedForecast: string;
          shortForecast: string;
          temperature: number;
          temperatureUnit: string;
          windSpeed: string;
          windDirection: string;
          isDaytime: boolean;
        }) => ({
          name: p.name,
          detailedForecast: p.detailedForecast,
          shortForecast: p.shortForecast,
          temperature: p.temperature,
          temperatureUnit: p.temperatureUnit,
          windSpeed: p.windSpeed,
          windDirection: typeof p.windDirection === 'string' ? p.windDirection.toLowerCase() : '',
          isDaytime: p.isDaytime,
        }));
        setNarrativeForecast(narr);

        const alertsWithOffice = await fetch(
          `/api/alerts?lat=${loc.lat}&lon=${loc.lon}&office=${meta.cwa}`
        );
        if (alertsWithOffice.ok) {
          const alertData = await alertsWithOffice.json();
          setAlerts(alertData.alerts || []);
          setFireDiscussion(alertData.fireDiscussion || '');
          setZoneForecast(alertData.zoneForecast || '');
          setBurnBanInfo(alertData.burnBanInfo || '');
        }
      }

      if (aqCurrentRes.ok) setCurrentAQI(await aqCurrentRes.json());
      if (aqForecastRes.ok) setAqiForecast(await aqForecastRes.json());
      if (aqMonitorsRes.ok) setAqiMonitors(await aqMonitorsRes.json());
      if (kbdiRes.ok) {
        const kbdiData = await kbdiRes.json();
        setKbdi(kbdiData.kbdi != null ? kbdiData : null);
      } else {
        setKbdi(null);
      }

      try {
        const stationsData = await fetch('/us_stations.json').then(r => r.json());
        let nearest = stationsData[0];
        let minDist = Infinity;
        for (const s of stationsData) {
          const d = Math.sqrt(Math.pow(s.lat - loc.lat, 2) + Math.pow(s.lon - loc.lon, 2));
          if (d < minDist) { minDist = d; nearest = s; }
        }
        const stationRes = await fetch(`/api/stations?id=${nearest.id}`);
        if (stationRes.ok) {
          const stationData = await stationRes.json();
          if (stationData.hasData) {
            const R = 3959;
            const dLat = (nearest.lat - loc.lat) * Math.PI / 180;
            const dLon = (nearest.lon - loc.lon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(loc.lat * Math.PI / 180) * Math.cos(nearest.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
            const distMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            setStationObservation({
              stationId: nearest.id,
              stationName: nearest.name,
              lat: nearest.lat,
              lon: nearest.lon,
              temp: stationData.temp,
              humidity: stationData.humidity,
              windSpeed: stationData.windSpeed,
              windDirection: stationData.windDirection,
              windDirectionCardinal: stationData.windDirection ? degreesToCardinal(stationData.windDirection) : '',
              windGust: stationData.windGust,
              visibility: stationData.visibility,
              time: stationData.time,
              distanceMiles: Math.round(distMiles * 10) / 10,
            });
          }
        }
      } catch { }

      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoized forecast computation that recalculates when weatherGridData or daysSinceRain changes
  const forecast = React.useMemo<HourlyForecast[]>(() => {
    if (!weatherGridData) return [];

    const { metadata: meta, gridFields: grid, lat, lon } = weatherGridData;

    // 1. Expand NWS time series maps for alignment
    const tempSeries = expandNWSTimeSeries(grid.temperature.values, 72);
    if (!tempSeries.length) return [];

    const rhMap = expandNWSTimeSeriesToMap(grid.relativeHumidity.values);
    const windSpeedMap = expandNWSTimeSeriesToMap(grid.windSpeed.values);
    const windDirMap = expandNWSTimeSeriesToMap(grid.windDirection.values);
    const windGustMap = expandNWSTimeSeriesToMap(grid.windGust.values);
    const skyCoverMap = expandNWSTimeSeriesToMap(grid.skyCover.values);
    const mixingHeightMap = expandNWSTimeSeriesToMap(grid.mixingHeight.values);
    const transportSpeedMap = expandNWSTimeSeriesToMap(grid.transportWindSpeed.values);
    const transportDirMap = expandNWSTimeSeriesToMap(grid.transportWindDirection.values);
    const hainesMap = expandNWSTimeSeriesToMap(grid.hainesIndex.values);
    const precipChanceMap = expandNWSTimeSeriesToMap(grid.probabilityOfPrecipitation.values);
    const ceilingMap = expandNWSTimeSeriesToMap(grid.ceilingHeight?.values || []);

    // Weather codes Map
    const weatherCodeMap = new Map<string, string>();
    for (const entry of grid.weather.values || []) {
      const [timeStr, durationStr] = entry.validTime.split('/');
      const startTime = new Date(timeStr);
      const hours = parseISODuration(durationStr);
      const code = entry.value?.[0]?.weather || '';
      for (let h = 0; h < hours; h++) {
        const time = new Date(startTime.getTime() + h * 3600000);
        weatherCodeMap.set(time.toISOString(), code);
      }
    }

    const hourlyData: HourlyForecast[] = [];
    const numHours = tempSeries.length;

    // Hoist Intl.DateTimeFormat formatter out of the 72-iteration loop for performance
    const localTimeFormatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      timeZone: meta.timeZone || 'America/Chicago',
    });

    // Fallback variables to carry last known values if NWS data is missing for tail hours
    let lastWindSpeed = 0;
    let lastWindDir = 0;
    let lastWindGust = 0;
    let lastSky = 0;
    let lastMixHeight = 1000;
    let lastTransSpeed = 0;
    let lastTransDir = 0;
    let lastHaines = 4;
    let lastPrecip = 0;

    for (let i = 0; i < numHours; i++) {
      const time = tempSeries[i].time;
      const tempC = tempSeries[i].value;
      const rh = rhMap.get(time);

      // Skip hours where temperature or relative humidity is missing (or null) to prevent false alerts
      if (tempC == null || rh == null) {
        continue;
      }

      // Carry forward last known values if fields are missing (or null) at the tail of the NWS forecast
      const windSpeedRaw = windSpeedMap.get(time) ?? lastWindSpeed;
      const windDir = windDirMap.get(time) ?? lastWindDir;
      const windGustRaw = windGustMap.get(time) ?? lastWindGust;
      const sky = skyCoverMap.get(time) ?? lastSky;
      const mixHeightRaw = mixingHeightMap.get(time) ?? lastMixHeight;
      const transSpeedRaw = transportSpeedMap.get(time) ?? lastTransSpeed;
      const transDir = transportDirMap.get(time) ?? lastTransDir;
      const haines = hainesMap.get(time) ?? lastHaines;
      const precip = precipChanceMap.get(time) ?? lastPrecip;

      // Update state history tracking
      lastWindSpeed = windSpeedRaw;
      lastWindDir = windDir;
      lastWindGust = windGustRaw;
      lastSky = sky;
      lastMixHeight = mixHeightRaw;
      lastTransSpeed = transSpeedRaw;
      lastTransDir = transDir;
      lastHaines = haines;
      lastPrecip = precip;

      // Dynamic unit conversions using convertNWSValue based on original NWS uom strings
      const tempF = convertNWSValue(tempC, grid.temperature.uom, 'F');
      const windSpeedMph = convertNWSValue(windSpeedRaw, grid.windSpeed.uom, 'mph');
      const windGustMph = convertNWSValue(windGustRaw, grid.windGust.uom, 'mph');
      const mixHeightFt = convertNWSValue(mixHeightRaw, grid.mixingHeight.uom, 'ft');
      const transSpeedMph = convertNWSValue(transSpeedRaw, grid.transportWindSpeed.uom, 'mph');

      const weatherCode = weatherCodeMap.get(time) ?? '';
      const vi = calculateVentilationIndex(mixHeightFt, transSpeedMph);
      const localDate = new Date(time);

      const fuelMoisture = calculateFuelMoisture(tempF, rh, prescription.daysSinceRain);
      const dispersion = determineDispersionCategory(mixHeightFt, transSpeedMph);
      const burnAssessment = assessBurnWindow(tempF, rh, windSpeedMph, windGustMph, mixHeightFt, vi);

      // --- Lavdas ADI + LVORI (see dispersion.ts for sources) ---
      const solarElev = solarElevationDeg(localDate, lat, lon);
      const isDay = solarElev > 0;
      const cloudTenths = Math.round(sky / 10);
      // NWS ceilingHeight is meters; missing/null means unlimited
      const ceilingRawM = ceilingMap.get(time);
      const ceilingFt = ceilingRawM != null ? ceilingRawM * 3.28084 : Infinity;
      const windKnots = windSpeedMph / 1.15078;
      const nri = netRadiationIndex(isDay, solarElev, cloudTenths, ceilingFt);
      const stability = stabilityClass(nri, windKnots);
      const mixHeightM = mixHeightFt / 3.28084;
      const transSpeedMs = mphToMs(transSpeedMph);
      const adi = atmosphericDispersionIndex(isDay, stability, mixHeightM, transSpeedMs);
      const adiCat = adiCategory(adi, isDay);
      const lvoriValue = lvori(rh, adi);

      hourlyData.push({
        time,
        localTime: localTimeFormatter.format(localDate),
        temp: Math.round(tempF),
        humidity: Math.round(rh),
        windSpeed: Math.round(windSpeedMph * 10) / 10,
        windGust: Math.round(windGustMph * 10) / 10,
        windDirection: windDir,
        windDirectionCardinal: degreesToCardinal(windDir),
        skyCover: Math.round(sky),
        skyCoverAbbr: getSkyCoverAbbr(sky),
        weatherCode,
        weatherAbbr: getWeatherAbbr(weatherCode),
        mixingHeight: Math.round(mixHeightFt),
        transportWindSpeed: Math.round(transSpeedMph * 10) / 10,
        transportWindSpeedMs: Math.round(mphToMs(transSpeedMph) * 10) / 10,
        transportWindDirection: transDir,
        transportWindDirectionCardinal: degreesToCardinal(transDir),
        hainesIndex: haines,
        precipChance: Math.round(precip),
        ventilationIndex: vi,
        ffwi: Math.round(calculateFFWI(tempF, rh, windSpeedMph) * 10) / 10,
        fuelMoisture1hr: Math.round(fuelMoisture.oneHour * 10) / 10,
        fuelMoisture10hr: Math.round(fuelMoisture.tenHour * 10) / 10,
        fuelMoisture100hr: Math.round(fuelMoisture.hundredHour * 10) / 10,
        dispersionCategory: dispersion.category,
        dispersionDescription: dispersion.description,
        stabilityClass: stability,
        adi: Math.round(adi * 10) / 10,
        adiCategory: adiCat.label,
        lvori: lvoriValue,
        isDay,
        burnQuality: burnAssessment.quality,
        burnScore: burnAssessment.score,
        ignitionProbability: Math.round(calculateIgnitionProbability(tempF, rh, fuelMoisture.oneHour)),
      });
    }

    return hourlyData;
  }, [weatherGridData, prescription.daysSinceRain]);

  const fetchForecast = useCallback(async (locationQuery: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery)}`);
      if (geoRes.status === 429) {
        throw new Error('Too many searches in a short time. Please wait a minute and try again.');
      }
      const geoData = await geoRes.json();
      if (!Array.isArray(geoData) || !geoData.length) throw new Error(`Location not found: "${locationQuery}"`);
      const loc = geoData[0] as GeocodedLocation;
      await fetchForecastByCoords(loc.lat, loc.lon, loc.displayName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  }, [fetchForecastByCoords]);

  // Find the forecast hour closest to the current time
  const currentForecastIdx = React.useMemo(() => {
    if (!forecast.length) return 0;
    const now = Date.now();
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < forecast.length; i++) {
      const diff = Math.abs(new Date(forecast[i].time).getTime() - now);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [forecast]);

  return (
    <DashboardContext.Provider
      value={{
        location,
        isLoading,
        error,
        prescription,
        setPrescription,
        forecast,
        currentForecastIdx,
        narrativeForecast,
        nwsOffice,
        timezone,
        lastUpdated,
        alerts,
        fireDiscussion,
        zoneForecast,
        burnBanInfo,
        stationObservation,
        currentAQI,
        aqiForecast,
        aqiMonitors,
        kbdi,
        fetchForecast,
        fetchForecastByCoords,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
