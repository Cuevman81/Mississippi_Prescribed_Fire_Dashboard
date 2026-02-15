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
  celsiusToFahrenheit,
  kmhToMph,
  knotsToMph,
  metersToFeet,
  mphToMs,
  degreesToCardinal,
  getSkyCoverAbbr,
  getWeatherAbbr,
  expandNWSTimeSeries,
} from './weather-utils';
import {
  calculateKBDITrend,
  calculateFFMC,
  calculateFuelMoisture,
  calculateIgnitionProbability,
  determineDispersionCategory,
  assessBurnWindow,
  calculateVentilationIndex,
} from './fire-science';

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
  const [prescription, setPrescription] = useState<PrescriptionParams>(DEFAULT_PRESCRIPTION);

  const [forecast, setForecast] = useState<HourlyForecast[]>([]);
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
        // Reverse geocode
        const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
          headers: { 'User-Agent': 'PrescribedBurnApp/3.0' }
        });
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

      // Step 2: Fetch weather + alerts + air quality in parallel
      const [weatherRes, aqCurrentRes, aqForecastRes, aqMonitorsRes] = await Promise.all([
        fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`),
        fetch(`/api/air-quality?type=current&lat=${loc.lat}&lon=${loc.lon}`),
        fetch(`/api/air-quality?type=forecast&lat=${loc.lat}&lon=${loc.lon}`),
        fetch(`/api/air-quality?type=monitors`),
      ]);

      // Process weather data
      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        const meta = weatherData.metadata;
        const grid = weatherData.gridFields;

        setNwsOffice(meta.cwa);
        setTimezone(meta.timeZone || 'America/Chicago');

        // Expand NWS time series
        const temps = expandNWSTimeSeries(grid.temperature, 72);
        const humidities = expandNWSTimeSeries(grid.relativeHumidity, 72);
        const windSpeeds = expandNWSTimeSeries(grid.windSpeed, 72);
        const windDirs = expandNWSTimeSeries(grid.windDirection, 72);
        const windGusts = expandNWSTimeSeries(grid.windGust, 72);
        const skyCovers = expandNWSTimeSeries(grid.skyCover, 72);
        const mixingHeights = expandNWSTimeSeries(grid.mixingHeight, 72);
        const transportSpeeds = expandNWSTimeSeries(grid.transportWindSpeed, 72);
        const transportDirs = expandNWSTimeSeries(grid.transportWindDirection, 72);
        const hainesIndices = expandNWSTimeSeries(grid.hainesIndex, 72);
        const precipChances = expandNWSTimeSeries(grid.probabilityOfPrecipitation, 72);

        // Process weather codes
        const weatherCodes: Array<{ time: string; value: string }> = [];
        for (const entry of grid.weather || []) {
          const [timeStr, durationStr] = entry.validTime.split('/');
          const startTime = new Date(timeStr);
          const hours = parseInt(durationStr.match(/PT(\d+)H/)?.[1] || '1');
          const code = entry.value?.[0]?.weather || '';
          for (let h = 0; h < hours; h++) {
            const time = new Date(startTime.getTime() + h * 3600000);
            weatherCodes.push({ time: time.toISOString(), value: code });
          }
        }

        const hourlyData: HourlyForecast[] = [];
        const numHours = Math.min(72, temps.length);

        for (let i = 0; i < numHours; i++) {
          const time = temps[i]?.time;
          if (!time) continue;

          const tempC = temps[i]?.value ?? 0;
          const tempF = celsiusToFahrenheit(tempC);
          const rh = humidities[i]?.value ?? 0;
          const windSpeedKmh = windSpeeds[i]?.value ?? 0;
          const windSpeedMph = kmhToMph(windSpeedKmh);
          const windDir = windDirs[i]?.value ?? 0;
          const windGustKmh = windGusts[i]?.value ?? 0;
          const windGustMph = kmhToMph(windGustKmh);
          const sky = skyCovers[i]?.value ?? 0;
          const mixHeightM = mixingHeights[i]?.value ?? 0;
          const mixHeightFt = metersToFeet(mixHeightM);
          const transSpeedKnots = transportSpeeds[i]?.value ?? 0;
          const transSpeedMph = knotsToMph(transSpeedKnots);
          const transDir = transportDirs[i]?.value ?? 0;
          const haines = hainesIndices[i]?.value ?? 0;
          const precip = precipChances[i]?.value ?? 0;
          const weatherCode = weatherCodes[i]?.value ?? '';

          const vi = calculateVentilationIndex(mixHeightFt, transSpeedMph);
          const localDate = new Date(time);
          const hour = localDate.getUTCHours(); 

          const fuelMoisture = calculateFuelMoisture(tempF, rh, prescription.daysSinceRain);
          const dispersion = determineDispersionCategory(mixHeightFt, transSpeedMph, hour);
          const burnAssessment = assessBurnWindow(tempF, rh, windSpeedMph, windGustMph, mixHeightFt, vi);

          hourlyData.push({
            time,
            localTime: localDate.toLocaleString('en-US', { timeZone: meta.timeZone || 'America/Chicago' }),
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
            kbdiTrend: Math.round(calculateKBDITrend(tempF, rh)),
            ffmc: Math.round(calculateFFMC(tempF, rh, windSpeedMph) * 10) / 10,
            fuelMoisture1hr: Math.round(fuelMoisture.oneHour * 10) / 10,
            fuelMoisture10hr: Math.round(fuelMoisture.tenHour * 10) / 10,
            fuelMoisture100hr: Math.round(fuelMoisture.hundredHour * 10) / 10,
            dispersionCategory: dispersion.category,
            dispersionDescription: dispersion.description,
            adjustedVI: dispersion.adjustedVI,
            burnQuality: burnAssessment.quality,
            burnScore: burnAssessment.score,
            ignitionProbability: Math.round(calculateIgnitionProbability(tempF, rh, fuelMoisture.oneHour)),
          });
        }

        setForecast(hourlyData);

        const narr = (weatherData.narrativePeriods || []).map((p: any) => ({
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
            const a = Math.sin(dLat/2)**2 + Math.cos(loc.lat*Math.PI/180)*Math.cos(nearest.lat*Math.PI/180)*Math.sin(dLon/2)**2;
            const distMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

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
      } catch {}

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [prescription.daysSinceRain]);

  const fetchForecast = useCallback(async (locationQuery: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery)}`);
      const geoData = await geoRes.json();
      if (!geoData.length) throw new Error(`Location not found: "${locationQuery}"`);
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
        alerts,
        fireDiscussion,
        zoneForecast,
        burnBanInfo,
        stationObservation,
        currentAQI,
        aqiForecast,
        aqiMonitors,
        fetchForecast,
        fetchForecastByCoords,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
