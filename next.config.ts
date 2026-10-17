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
            // img-src must include the basemap tile host the maps actually use:
            // server.arcgisonline.com (Esri Light Gray Canvas on all maps, and
            // the HMS satellite view). Leaflet loads tiles as <img>, so
            // connect-src doesn't need it. style-src must include unpkg for
            // leaflet.css loaded in layout.tsx, and img-src unpkg for the
            // images that stylesheet references. Fonts come from next/font,
            // which self-hosts them at build time, so no Google Fonts hosts.
            // connect-src is 'self' only: the browser calls only /api/*, and
            // the server routes call NWS, IEM, AirNow and Nominatim.
            // 'unsafe-eval' is not needed by production Next.js (dev only).
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://server.arcgisonline.com https://unpkg.com; connect-src 'self'; font-src 'self'; frame-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
