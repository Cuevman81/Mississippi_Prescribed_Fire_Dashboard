import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Field names as the replacement AirNow services return them (checked live
// 2026-09-22 against /aq/observation/current/ziplatlong/ and /aq/forecast/current/)
const NEW_OBS = [
  { dateObserved: '2026-09-22', hourObserved: '21:00', localTimeZone: 'CDT', reportingAreaName: 'Jackson', siteID: '280490020', siteName: 'Jackson', parameterName: 'PM2.5', nowcastAQI: 112, aqiCategoryName: 'Unhealthy for Sensitive Groups' },
  { dateObserved: '2026-09-22', hourObserved: '21:00', localTimeZone: 'CDT', reportingAreaName: 'Jackson', siteID: '280490020', siteName: 'Jackson', parameterName: 'OZONE', nowcastAQI: 43, aqiCategoryName: 'Good' },
  // No AQI at all: must be dropped, not shown as 0 ("Good")
  { dateObserved: '2026-09-22', hourObserved: '21:00', localTimeZone: 'CDT', reportingAreaName: 'Jackson', siteID: '280490021', siteName: 'Jackson', parameterName: 'PM10', aqiCategoryName: 'Good' },
];
const NEW_FORECAST = [
  { dateIssue: '2026-09-22', dateValid: '2026-09-23 ', reportingArea: 'Jackson', reportingAreaCode: 'MS001', stateCode: 'MS', parameterName: 'OZONE', aqi: 51, forecastAgency: 'MDEQ', categoryNumber: 2, categoryName: 'Moderate', actionDay: false, discussion: '' },
  { dateIssue: '2026-09-22', dateValid: '2026-09-23', reportingArea: 'Jackson', reportingAreaCode: 'MS001', stateCode: 'MS', parameterName: 'PM2.5', aqi: -1, forecastAgency: 'MDEQ', categoryNumber: 1, categoryName: 'Good', actionDay: false, discussion: '' },
];
const OLD_OBS = [
  { DateObserved: '2026-09-22 ', HourObserved: 16, LocalTimeZone: 'CST', ReportingArea: 'Jackson', StateCode: 'MS', Latitude: 32.3, Longitude: -90.18, ParameterName: 'O3', AQI: 43, Category: { Number: 1, Name: 'Good' } },
];

let GET: typeof import('./route').GET;
let ip = 1;
const req = (query: string) =>
  new NextRequest(`http://localhost/api/air-quality?${query}`, { headers: { 'x-forwarded-for': `10.0.0.${ip++}` } });

const inits: RequestInit[] = [];
function upstream(body: unknown) {
  const urls: string[] = [];
  inits.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    urls.push(String(url));
    inits.push(init);
    return new Response(JSON.stringify(body), { status: 200 });
  }));
  return urls;
}

beforeAll(async () => {
  vi.stubEnv('AIRNOW_API_KEY', 'FAKEkey9x2');
  ({ GET } = await import('./route'));
});
afterEach(() => vi.unstubAllGlobals());

describe('current AQI (AirNow 2026-09-30 migration)', () => {
  it('calls the replacement service, not the retired latLong one', async () => {
    const urls = upstream(NEW_OBS);
    await GET(req('type=current&lat=32.2988&lon=-90.1848'));
    expect(urls[0]).toContain('/aq/observation/current/ziplatlong/');
    expect(urls[0]).not.toContain('/aq/observation/latLong/');
  });

  it('maps nowcastAQI and aqiCategoryName, and drops a reading with no AQI', async () => {
    upstream(NEW_OBS);
    const data = await (await GET(req('type=current&lat=32.2988&lon=-90.1848'))).json();
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({
      aqi: 112,
      category: { number: 3, name: 'Unhealthy for Sensitive Groups' },
      hourObserved: 21,
      reportingArea: 'Jackson',
      parameterName: 'PM2.5',
    });
    expect(data.map((o: { aqi: number }) => o.aqi)).not.toContain(0);
  });

  it('still reads the old field names', async () => {
    upstream(OLD_OBS);
    const data = await (await GET(req('type=current&lat=32.2988&lon=-90.1848'))).json();
    expect(data[0]).toMatchObject({ aqi: 43, category: { number: 1, name: 'Good' }, hourObserved: 16, dateObserved: '2026-09-22' });
  });

  it('builds the URL from the parsed numbers, not the raw query text', async () => {
    const urls = upstream(NEW_OBS);
    await GET(req(`type=current&lat=${encodeURIComponent('32.3&distance=500')}&lon=-90.2`));
    const u = new URL(urls[0]);
    expect(u.searchParams.get('latitude')).toBe('32.30');
    expect(u.searchParams.get('distance')).toBe('25');
  });

  it('caches per rounded location and allows a slow AirNow 30 s', async () => {
    const urls = upstream(NEW_OBS);
    await GET(req('type=current&lat=32.2988&lon=-90.1848'));
    await GET(req('type=current&lat=32.3012&lon=-90.1802'));
    expect(urls[0]).toBe(urls[1]); // same 0.01° cell, same cache key
    expect((inits[0] as { next?: { revalidate?: number } }).next?.revalidate).toBe(600);
    expect(inits[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('gives each reading its UTC observation time', async () => {
    upstream(NEW_OBS);
    const data = await (await GET(req('type=current&lat=32.2988&lon=-90.1848'))).json();
    // 21:00 CDT on Sep 22 is 02:00 UTC on Sep 23
    expect(data[0].observedAt).toBe('2026-09-23T02:00:00.000Z');
    upstream([{ ...NEW_OBS[0], localTimeZone: 'XYZ' }]);
    const unknown = await (await GET(req('type=current&lat=32.2988&lon=-90.1848'))).json();
    expect(unknown[0].observedAt).toBeNull();
  });
});

describe('AQI forecast (AirNow 2026-09-30 migration)', () => {
  it('calls the replacement service and maps dateValid and the flat category', async () => {
    const urls = upstream(NEW_FORECAST);
    const data = await (await GET(req('type=forecast&lat=32.2988&lon=-90.1848'))).json();
    expect(urls[0]).toContain('/aq/forecast/current/');
    expect(urls[0]).not.toContain('/aq/forecast/latLong/');
    // Trimmed: the page matches this against today's date with ===
    expect(data[0]).toMatchObject({ dateForecast: '2026-09-23', aqi: 51, category: { number: 2, name: 'Moderate' } });
    expect(data[1]).toMatchObject({ dateForecast: '2026-09-23', aqi: -1, category: { number: 1, name: 'Good' } });
  });
});
