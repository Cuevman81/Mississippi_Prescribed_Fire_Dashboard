'use client';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDashboard } from '@/lib/dashboard-context';
import { MapPin, Radio } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix for default marker icons in Leaflet with Next.js
const customMarkerIcon = L.divIcon({
  html: renderToStaticMarkup(<MapPin className="text-orange-600 fill-orange-100" size={32} />),
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: '',
});

const stationIcon = L.divIcon({
  html: renderToStaticMarkup(<Radio className="text-blue-600" size={24} />),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
  className: '',
});

function MapEvents() {
  const { fetchForecastByCoords, isLoading } = useDashboard();
  
  useMapEvents({
    click(e) {
      if (isLoading) return;
      fetchForecastByCoords(e.latlng.lat, e.latlng.lng);
    },
  });
  
  return null;
}

export default function LocationMap() {
  const { location, stationObservation, aqiMonitors } = useDashboard();

  if (!location) return null;

  const center: [number, number] = [location.lat, location.lon];

  return (
    <div className="relative h-[300px] w-full rounded-lg overflow-hidden border shadow-sm">
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap'
        />
        
        <MapEvents />

        <Marker position={center} icon={customMarkerIcon}>
          <Popup>
            <div className="text-xs font-medium">
              {location.displayName}
            </div>
          </Popup>
        </Marker>

        {stationObservation && (
          <Marker 
            position={[stationObservation.lat, stationObservation.lon]} 
            icon={stationIcon}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold">Station: {stationObservation.stationName}</p>
                <p>{stationObservation.distanceMiles} miles away</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 px-2 py-1 rounded border text-[10px] text-slate-500 pointer-events-none">
        Click anywhere on map to change location
      </div>
    </div>
  );
}
