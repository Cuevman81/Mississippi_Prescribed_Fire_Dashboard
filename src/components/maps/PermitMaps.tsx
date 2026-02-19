'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { MFCPermit } from '@/lib/types';
import { PERMIT_DISPERSION_COLORS } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

interface Props {
  permits: MFCPermit[];
  type: 'density' | 'smoke' | 'dispersion';
}

export default function PermitMaps({ permits, type }: Props) {
  const center: [number, number] = [32.7, -89.5];

  const validPermits = permits.filter(
    (p) => p.latitude > 29 && p.latitude < 36 && p.longitude < -87 && p.longitude > -92
  );

  return (
    <MapContainer
      center={center}
      zoom={7}
      style={{ height: '400px', width: '100%', borderRadius: '0.5rem' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap'
      />

      {/* Heatmap layer for density type */}
      {type === 'density' && validPermits.length > 0 && (
        <HeatmapLayer permits={validPermits} />
      )}

      {validPermits.map((p) => {
        const position: [number, number] = [p.latitude, p.longitude];
        const markerKey = `${type}-${p.objectId}`;

        // Smoke type: render arrow markers
        if (type === 'smoke' && p.windDeg != null && p.windSpeed > 0) {
          return (
            <WindArrowMarker
              key={markerKey}
              position={position}
              windDeg={p.windDeg}
              windSpeed={p.windSpeed}
              permit={p}
            />
          );
        }

        // density and dispersion: circle markers
        const radius = type === 'density'
          ? Math.max(3, Math.min(8, Math.sqrt(p.burnAcresEstimate || 1) * 0.4))
          : Math.max(4, Math.min(12, Math.sqrt(p.burnAcresEstimate || 1) * 0.5));

        let fillColor = '#dc2626'; // Default red for density
        let strokeColor = '#991b1b';

        if (type === 'dispersion') {
          fillColor = PERMIT_DISPERSION_COLORS[p.dispersionQuality] || '#94a3b8';
          strokeColor = '#1e293b';
        }

        return (
          <CircleMarker
            key={markerKey}
            center={position}
            radius={radius}
            fillColor={fillColor}
            fillOpacity={type === 'density' ? 0.8 : 0.7}
            color={strokeColor}
            weight={1.5}
          >
            <Popup>
              <PermitPopup permit={p} />
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

/** Leaflet.heat layer — imperatively added via useMap */
function HeatmapLayer({ permits }: { permits: MFCPermit[] }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const points: [number, number, number][] = permits.map((p) => [
      p.latitude,
      p.longitude,
      Math.min(1, (p.burnAcresEstimate || 1) / 100), // intensity by acreage
    ]);

    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 20,
      maxZoom: 10,
      minOpacity: 0.3,
      gradient: {
        0.2: '#ffffb2',
        0.4: '#fed976',
        0.6: '#feb24c',
        0.8: '#fd8d3c',
        1.0: '#e31a1c',
      },
    });

    heat.addTo(map);
    layerRef.current = heat;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, permits]);

  return null;
}

/** Wind arrow marker — SVG arrow icon rotated to downwind direction */
function WindArrowMarker({
  position,
  windDeg,
  windSpeed,
  permit,
}: {
  position: [number, number];
  windDeg: number;
  windSpeed: number;
  permit: MFCPermit;
}) {
  // Wind blows FROM windDeg. Smoke goes DOWNWIND (opposite).
  const downwindDeg = (windDeg + 180) % 360;

  // Scale arrow size by wind speed (min 18px, max 36px)
  const size = Math.max(18, Math.min(36, windSpeed * 2.5));

  const icon = L.divIcon({
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${downwindDeg}deg);">
      <path d="M12 2 L16 20 L12 16 L8 20 Z" fill="#dc2626" stroke="#991b1b" stroke-width="1" opacity="0.8"/>
    </svg>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  return (
    <Marker position={position} icon={icon}>
      <Popup>
        <PermitPopup permit={permit} />
      </Popup>
    </Marker>
  );
}

/** Shared popup content */
function PermitPopup({ permit: p }: { permit: MFCPermit }) {
  return (
    <div className="text-xs">
      <p className="font-bold">{p.county}</p>
      <p>Acres: {p.burnAcresEstimate}</p>
      <p>Wind: {p.windDirection} @ {p.windSpeed} mph</p>
      <p>Mix Height: {p.mixingHeight} ft</p>
      <p>VI: {p.ventilationIndex.toLocaleString()}</p>
      <p className="font-medium">{p.dispersionQuality}</p>
    </div>
  );
}
