'use client';

import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LightGrayBasemap } from './Basemap';
import { BurnBanLayer } from './BurnBanLayer';

/** Statewide view of MFC county burn bans */
export default function BurnBanMap() {
  return (
    <MapContainer
      center={[32.7, -89.7]}
      zoom={6}
      minZoom={5}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
    >
      <LightGrayBasemap />
      <BurnBanLayer showAllOutlines />
    </MapContainer>
  );
}
