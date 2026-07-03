import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            // img-src must include the basemap tile CDNs the maps actually use:
            // CARTO (all maps) and ArcGIS (HMS satellite view). style-src must
            // include unpkg for leaflet.css loaded in layout.tsx.
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.tile.openstreetmap.org https://*.tile.osm.org https://unpkg.com https://*.openstreetmap.org; connect-src 'self' https://api.weather.gov https://*.weather.gov https://mesonet.agron.iastate.edu https://*.airnowapi.org https://nominatim.openstreetmap.org; font-src 'self' https://fonts.gstatic.com; frame-src 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
