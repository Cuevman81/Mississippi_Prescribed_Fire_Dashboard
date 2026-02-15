'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { AQIMonitor } from '@/lib/types';
import { getAQIColorByNumber, getAQICategoryName } from '@/lib/aqi-utils';
import 'leaflet/dist/leaflet.css';

interface Props {
  monitors: AQIMonitor[];
}

export default function MonitorMap({ monitors }: Props) {
  // Center on Mississippi
  const center: [number, number] = [32.5, -89.75];

  return (
    <MapContainer
      center={center}
      zoom={7}
      style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {monitors.map((m, i) => (
        <CircleMarker
          key={i}
          center={[m.latitude, m.longitude]}
          radius={10}
          fillColor={getAQIColorByNumber(m.category)}
          fillOpacity={0.8}
          color="#333"
          weight={1}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-bold">{m.siteName}</p>
              <p>{m.parameter}: AQI {m.aqi}</p>
              <p>{getAQICategoryName(m.category)}</p>
              {m.utc && (
                <p className="text-[10px] text-gray-500 mt-1">
                  Last update: {(() => {
                    try {
                      // AirNow UTC format is typically "YYYY-MM-DDTHH:00" or ISO string
                      const d = new Date(m.utc.includes('T') ? m.utc + 'Z' : m.utc);
                      if (isNaN(d.getTime())) return m.utc;
                      return d.toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                        hour12: true, timeZoneName: 'short',
                      });
                    } catch { return m.utc; }
                  })()}
                </p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
