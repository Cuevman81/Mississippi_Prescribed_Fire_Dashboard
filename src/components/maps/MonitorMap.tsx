import React, { useMemo } from 'react';
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

  // Group monitors by site location so multi-pollutant sites only render one colored dot
  const groupedMonitors = useMemo(() => {
    const groups: Record<string, {
      siteName: string;
      latitude: number;
      longitude: number;
      readings: AQIMonitor[];
      maxAqi: number;
      maxCategory: number;
      utc: string;
    }> = {};

    monitors.forEach(m => {
      if (!groups[m.siteName]) {
        groups[m.siteName] = {
          siteName: m.siteName,
          latitude: m.latitude,
          longitude: m.longitude,
          readings: [],
          maxAqi: -1,
          maxCategory: -1,
          utc: m.utc
        };
      }

      groups[m.siteName].readings.push(m);

      // Determine the highest (worst) AQI for this site
      if (m.aqi > groups[m.siteName].maxAqi) {
        groups[m.siteName].maxAqi = m.aqi;
        groups[m.siteName].maxCategory = m.category;
      }
    });

    return Object.values(groups);
  }, [monitors]);

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
      {groupedMonitors.map((site, i) => (
        <CircleMarker
          key={i}
          center={[site.latitude, site.longitude]}
          radius={11}
          fillColor={getAQIColorByNumber(site.maxCategory)}
          fillOpacity={0.85}
          color="#333"
          weight={1.5}
        >
          <Popup>
            <div className="text-xs min-w-[150px]">
              <p className="font-bold border-b border-gray-200 pb-1 mb-2">
                {site.siteName}
              </p>

              <div className="space-y-1 mb-2">
                {site.readings.map((r, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 px-1.5 py-1 rounded">
                    <span className="font-medium">{r.parameter}:</span>
                    <span className="font-bold flex items-center gap-1.5">
                      {r.aqi}
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: getAQIColorByNumber(r.category) }}
                      />
                    </span>
                  </div>
                ))}
              </div>

              <p className="font-semibold text-[13px] text-center mt-2 pt-1 border-t border-gray-200">
                Overall: {getAQICategoryName(site.maxCategory)}
              </p>

              {site.utc && (
                <p className="text-[10px] text-gray-400 text-center mt-1.5 pb-1">
                  Updated: {(() => {
                    try {
                      const d = new Date(site.utc.includes('T') ? site.utc + 'Z' : site.utc);
                      if (isNaN(d.getTime())) return site.utc;
                      return d.toLocaleString('en-US', {
                        hour: 'numeric', minute: '2-digit',
                        hour12: true
                      });
                    } catch { return site.utc; }
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
