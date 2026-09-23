import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { CRITICAL_FIRE_ALERTS, SMOKE_RELEVANT_ALERTS } from '@/lib/constants';

let ip = 1;
const req = () =>
  new NextRequest('http://localhost/api/alerts?lat=32.2988&lon=-90.1848', { headers: { 'x-forwarded-for': `10.0.1.${ip++}` } });

const POINT = { properties: { forecastZone: 'https://api.weather.gov/zones/forecast/MSZ052' } };
const feature = (event: string) => ({ properties: { event, headline: `${event} test`, description: '', severity: 'Severe', onset: '', expires: '' } });

/** Stub NWS: `points` and `alerts` are a response body, an HTTP status, or 'throw'. */
function nws({ points = POINT as unknown, alerts = { features: [] } as unknown }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const pick = String(url).includes('/points/') ? points : alerts;
    if (pick === 'throw') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    if (typeof pick === 'number') return new Response('{}', { status: pick });
    return new Response(JSON.stringify(pick), { status: 200 });
  }));
}
afterEach(() => vi.unstubAllGlobals());

describe('burn-veto alerts reach the browser', () => {
  it('uses current NWS event names (Excessive Heat Warning was renamed in 2025)', () => {
    expect(CRITICAL_FIRE_ALERTS).toContain('Extreme Heat Warning');
    expect(CRITICAL_FIRE_ALERTS as readonly string[]).not.toContain('Excessive Heat Warning');
  });

  it('passes every veto and smoke-management event, and still filters unrelated ones', async () => {
    const events = [...CRITICAL_FIRE_ALERTS, ...SMOKE_RELEVANT_ALERTS, 'Flood Warning'];
    nws({ alerts: { features: events.map(feature) } });
    const body = await (await GET(req())).json();
    const returned = body.alerts.map((a: { event: string }) => a.event);
    for (const e of [...CRITICAL_FIRE_ALERTS, ...SMOKE_RELEVANT_ALERTS]) expect(returned).toContain(e);
    expect(returned).not.toContain('Flood Warning');
    expect(body.alertsAvailable).toBe(true);
  });
});

describe('an NWS outage is not reported as "no alerts"', () => {
  it('quiet day: alertsAvailable is true', async () => {
    nws({});
    const body = await (await GET(req())).json();
    expect(body).toMatchObject({ alerts: [], alertsAvailable: true });
  });

  it('alerts call fails: alertsAvailable is false', async () => {
    nws({ alerts: 503 });
    const body = await (await GET(req())).json();
    expect(body).toMatchObject({ alerts: [], alertsAvailable: false });
  });

  it('points call fails: alertsAvailable is false', async () => {
    nws({ points: 503 });
    const body = await (await GET(req())).json();
    expect(body.alertsAvailable).toBe(false);
  });

  it('upstream timeout: 500 with alertsAvailable false', async () => {
    nws({ points: 'throw' });
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect((await res.json()).alertsAvailable).toBe(false);
  });
});
