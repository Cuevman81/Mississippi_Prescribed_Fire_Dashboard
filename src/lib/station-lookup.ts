// ============================================================
// Nearest Weather Station Lookup
// Uses pre-computed station list for instant lookup
// ============================================================

import type { WeatherStation } from './types';

let stationsCache: WeatherStation[] | null = null;

/** Load station data (cached after first load) */
export async function loadStations(): Promise<WeatherStation[]> {
  if (stationsCache) return stationsCache;

  const res = await fetch('/us_stations.json');
  stationsCache = await res.json();
  return stationsCache!;
}

/** Calculate Euclidean distance between two points */
function euclideanDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2));
}

/** Approximate distance in miles using Haversine */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Find the nearest weather station to given coordinates */
export async function findNearestStation(
  lat: number,
  lon: number
): Promise<WeatherStation & { distanceMiles: number }> {
  const stations = await loadStations();

  let nearest: WeatherStation | null = null;
  let minDist = Infinity;

  for (const station of stations) {
    const dist = euclideanDistance(lat, lon, station.lat, station.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }

  if (!nearest) throw new Error('No stations found');

  const distanceMiles = haversineDistance(lat, lon, nearest.lat, nearest.lon);

  return { ...nearest, distanceMiles: Math.round(distanceMiles * 10) / 10 };
}
