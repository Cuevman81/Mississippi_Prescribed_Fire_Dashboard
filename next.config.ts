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
            // connect-src is 'self' only: the browser calls only /api/*, and
            // the server routes call NWS, IEM, AirNow and Nominatim.
            // 'unsafe-eval' is not needed by production Next.js (dev only).
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://*.tile.openstreetmap.org https://*.tile.osm.org https://unpkg.com https://*.openstreetmap.org; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; frame-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
