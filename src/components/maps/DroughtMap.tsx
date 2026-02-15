'use client';

import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { DROUGHT_COLORS } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

interface Props {
  data: GeoJSON.FeatureCollection;
}

export default function DroughtMap({ data }: Props) {
  const center: [number, number] = [38, -96]; // Center on contiguous US

  const droughtStyle = (feature: GeoJSON.Feature | undefined) => {
    const dm = feature?.properties?.dm ?? feature?.properties?.DM ?? 0;
    const colorEntry = DROUGHT_COLORS[dm as number];
    return {
      fillColor: colorEntry?.color || '#ccc',
      fillOpacity: 0.7,
      color: '#666',
      weight: 0.5,
    };
  };

  return (
    <MapContainer
      center={center}
      zoom={4}
      style={{ height: '500px', width: '100%', borderRadius: '0.5rem' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap'
      />
      <GeoJSON
        data={data}
        style={droughtStyle}
        onEachFeature={(feature, layer) => {
          const dm = feature.properties?.dm ?? feature.properties?.DM ?? 0;
          const label = feature.properties?.label || DROUGHT_COLORS[dm]?.label || `D${dm}`;
          layer.bindPopup(`<b>${label}</b>`);
        }}
      />
    </MapContainer>
  );
}
