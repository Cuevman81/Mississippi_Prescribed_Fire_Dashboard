import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { MS_COUNTY_COUNT } from '@/lib/burn-bans';

let ip = 1;
const req = (query = '') =>
  new NextRequest(`http://localhost/api/burn-bans${query}`, { headers: { 'x-forwarded-for': `10.0.2.${ip++}` } });

const LAYER = {
  type: 'FeatureCollection',
  features: Array.from({ length: MS_COUNTY_COUNT }, (_, i) => {
    const NAME = i === 0 ? 'Rankin' : i === 1 ? 'Carroll' : `County${i}`;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-90, 32] },
      properties: { NAME, county_name_csv_match: NAME, hasCountyBan: i < 2 ? 1 : 0, hasMFCBan: 0 },
    };
  }),
};
const META = { editingInfo: { dataLastEditDate: Date.now() - 600_000 } };
const CSV = `county_name,mfc_exemption_1,cbm_exemption_2,cfs_exemption_3,cc_exemption_4,afb_exemption_5,mfc_ban
Rankin,TRUE ,TRUE,TRUE,TRUE,,
Carroll,TRUE ,,TRUE,TRUE,,
`;
const POINT = { features: [{ attributes: { NAME: 'Rankin' } }] };

type Stub = unknown | number | 'throw';
/** Stub the upstreams: each is a body, an HTTP status, or 'throw' (timeout) */
function upstream({ layer = LAYER as Stub, meta = META as Stub, csv = CSV as Stub, point = POINT as Stub }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    const pick = u.includes('/sharing/rest/content/items/') ? csv
      : u.includes('geometryType=esriGeometryPoint') ? point
      : u.includes('/query?') ? layer
      : meta;
    if (pick === 'throw') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    if (typeof pick === 'number') return new Response('{}', { status: pick });
    return new Response(typeof pick === 'string' ? pick : JSON.stringify(pick), { status: 200 });
  }));
}
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/burn-bans', () => {
  it('lists banned counties with exemptions, an as-of time and the source', async () => {
    upstream({});
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.available).toBe(true);
    expect(body.bannedCounties).toEqual([
      { name: 'Carroll', mfcBan: false, exemptions: [1, 3, 4] },
      { name: 'Rankin', mfcBan: false, exemptions: [1, 2, 3, 4] },
    ]);
    expect(body.asOf).toBe(new Date(META.editingInfo.dataLastEditDate).toISOString());
    expect(body.source).toBe('https://www.mfc.ms.gov/burning-info/burn-bans/');
    expect(body.geojson).toBeUndefined();
  });

  it('returns the county for a location', async () => {
    upstream({});
    const body = await (await GET(req('?lat=32.27&lon=-90.0'))).json();
    expect(body.location).toEqual({ county: 'Rankin', lookupFailed: false });
  });

  it('returns null county for a point outside Mississippi', async () => {
    upstream({ point: { features: [] } });
    const body = await (await GET(req('?lat=30.4&lon=-91.1'))).json();
    expect(body.location).toEqual({ county: null, lookupFailed: false });
  });

  it('returns county outlines, without other fields, only when asked', async () => {
    upstream({});
    const body = await (await GET(req('?geometry=1'))).json();
    expect(body.geojson.features).toHaveLength(MS_COUNTY_COUNT);
    expect(body.geojson.features[0].properties).toEqual({ name: 'Rankin' });
  });

  it('rejects bad coordinates', async () => {
    upstream({});
    expect((await GET(req('?lat=abc&lon=-90'))).status).toBe(400);
    expect((await GET(req('?lat=32'))).status).toBe(400);
  });
});

describe('a failed MFC source is never reported as "no bans"', () => {
  it.each([
    ['HTTP error', 503],
    ['timeout', 'throw'],
    ['ArcGIS error body', { error: { code: 400, message: 'Invalid query' } }],
    ['empty county list', { type: 'FeatureCollection', features: [] }],
  ])('county layer %s: 502, available false, nothing cached', async (_label, layer) => {
    upstream({ layer });
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(body.available).toBe(false);
    expect(body.reason).toMatch(/burn ban status unavailable/i);
    expect(body.bannedCounties).toBeUndefined();
  });

  it('CSV down: bans still listed, exemptions marked unknown', async () => {
    upstream({ csv: 500 });
    const body = await (await GET(req())).json();
    expect(body.available).toBe(true);
    expect(body.exemptionsAvailable).toBe(false);
    expect(body.bannedCounties.map((b: { exemptions: unknown }) => b.exemptions)).toEqual([null, null]);
  });

  it('layer metadata down: list still served, as-of reported as unknown', async () => {
    upstream({ meta: 'throw' });
    const body = await (await GET(req())).json();
    expect(body.available).toBe(true);
    expect(body.asOf).toBeNull();
  });

  it('county lookup down: lookupFailed, and the answer is not cached', async () => {
    upstream({ point: 503 });
    const res = await GET(req('?lat=32.27&lon=-90.0'));
    expect((await res.json()).location).toEqual({ county: null, lookupFailed: true });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
