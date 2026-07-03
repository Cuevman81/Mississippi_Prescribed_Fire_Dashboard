'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON, LayersControl, useMap } from 'react-leaflet';
import type { HMSData } from '@/lib/types';
import { SMOKE_COLORS } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

const { BaseLayer, Overlay } = LayersControl;

interface Props {
  data: HMSData;
  center?: [number, number];
  zoom?: number;
}

/** Fly to the new region when the selector changes (MapContainer only
 *  honors center/zoom on first mount). */
function RegionView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center[0], center[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function HMSFireSmokeMap({ data, center = [33, -88], zoom = 5 }: Props) {

  const smokeStyle = (feature: GeoJSON.Feature | undefined) => {
    const density = feature?.properties?.densityLabel || 'Unknown';
    return {
      fillColor: SMOKE_COLORS[density] || '#A0A0A0',
      fillOpacity: 0.4,
      color: SMOKE_COLORS[density] || '#A0A0A0',
      weight: 1,
      opacity: 0.6,
    };
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      // Canvas renderer draws the thousands of fire detections as pixels
      // instead of one SVG DOM node each — keeps pan/zoom smooth
      preferCanvas
      style={{ height: '600px', width: '100%', borderRadius: '0.5rem' }}
    >
      <RegionView center={center} zoom={zoom} />
      <LayersControl position="topright">
        <BaseLayer checked name="Street Map">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap'
          />
        </BaseLayer>
        <BaseLayer name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; Esri'
          />
        </BaseLayer>

        {data.smoke && (
          <Overlay checked name="Smoke Polygons">
            <GeoJSON
              key={data.date + '-smoke'}
              data={data.smoke}
              style={smokeStyle}
              onEachFeature={(feature, layer) => {
                const density = feature.properties?.densityLabel || 'Unknown';
                layer.bindPopup(`<b>Smoke</b><br/>Density: ${density}`);
              }}
            />
          </Overlay>
        )}

        <Overlay checked name="Fire Detections">
          {/* We wrap circles in a fragment via the LayersControl */}
          <></>
        </Overlay>
      </LayersControl>

      {/* Fire detection markers */}
      {data.fires.map((fire, i) => {
        const radius = Math.max(3, Math.min(15, Math.log(fire.frp + 1) * 2));
        return (
          <CircleMarker
            key={i}
            center={[fire.lat, fire.lon]}
            radius={radius}
            fillColor="#dc2626"
            fillOpacity={0.7}
            color="#991b1b"
            weight={1}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold">Fire Detection</p>
                <p>Time: {fire.time} UTC</p>
                <p>Satellite: {fire.satellite}</p>
                <p>Method: {fire.method}</p>
                <p>FRP: {fire.frp} MW</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
