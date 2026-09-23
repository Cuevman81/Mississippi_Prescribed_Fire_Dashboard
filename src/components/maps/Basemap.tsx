import { LayerGroup, TileLayer } from 'react-leaflet';

// CARTO basemaps now require an API key: tiles fetched without one carry an
// "API KEY REQUIRED" watermark (carto.com/basemaps/apikey). Esri's keyless
// Light Gray Canvas replaces CARTO Positron (light_all). It comes as base
// tiles plus a separate label layer, grouped here so a layer switcher
// toggles both together.
const ESRI_CANVAS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
// As in leaflet-providers (Esri.WorldGrayCanvas)
const ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';
// Canvas tiles stop at z16; above that Esri serves a "Map data not yet
// available" placeholder, so Leaflet upscales z16 instead
const MAX_NATIVE_ZOOM = 16;

export function LightGrayBasemap({ labels = true }: { labels?: boolean }) {
  return (
    <LayerGroup>
      <TileLayer
        url={`${ESRI_CANVAS}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`}
        attribution={ATTRIBUTION}
        maxNativeZoom={MAX_NATIVE_ZOOM}
      />
      {labels && (
        <TileLayer
          url={`${ESRI_CANVAS}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`}
          maxNativeZoom={MAX_NATIVE_ZOOM}
        />
      )}
    </LayerGroup>
  );
}
