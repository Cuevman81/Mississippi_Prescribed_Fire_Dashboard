import { describe, expect, it } from 'vitest';
import { burnWindowRestrictions, rxViolations, vetoesForWindow } from './burn-windows';
import { DEFAULT_PRESCRIPTION } from './constants';
import type { AlertInfo } from './types';
import type { LocationBanStatus } from './burn-bans';

const rx = DEFAULT_PRESCRIPTION; // RH 30-55, wind 4-15, temp 40-80, VI >= 20,000
const inRx = { temp: 60, humidity: 40, windSpeed: 8, ventilationIndex: 40000 };

const alert = (event: string, ends: string | null = null, expires = ''): AlertInfo =>
  ({ event, headline: '', description: '', severity: 'Severe', onset: '', expires, ends });
const ban = (effect: LocationBanStatus['effect'], message = `${effect} message`): LocationBanStatus =>
  ({ effect, county: 'Hinds', ban: null, message });

describe('rxViolations', () => {
  it('is empty for an hour inside every limit, including the limits themselves', () => {
    expect(rxViolations(inRx, rx)).toEqual([]);
    expect(rxViolations({ temp: 40, humidity: 55, windSpeed: 15, ventilationIndex: 20000 }, rx)).toEqual([]);
  });

  it('names each limit an hour breaks', () => {
    expect(rxViolations({ temp: 85, humidity: 25, windSpeed: 2, ventilationIndex: 10000 }, rx))
      .toEqual(['High Temp', 'Low RH', 'Low Wind', 'Low VI']);
    expect(rxViolations({ ...inRx, temp: 35, humidity: 70, windSpeed: 20 }, rx))
      .toEqual(['Low Temp', 'High RH', 'High Wind']);
  });

  it('uses the custom prescription, not the fixed burn-quality thresholds', () => {
    // 50% RH scores full marks in assessBurnWindow, but is too wet for this Rx
    expect(rxViolations({ ...inRx, humidity: 50 }, { ...rx, humidityMax: 45 })).toEqual(['High RH']);
  });
});

describe('burnWindowRestrictions', () => {
  const base = { alerts: [], alertsAvailable: true, burnBanStatus: ban('none'), burnBansLoaded: true };

  it('has nothing to say when alerts were checked and there is no ban', () => {
    expect(burnWindowRestrictions(base)).toEqual({ vetoes: [], notes: [] });
  });

  it('vetoes on an active NWS critical fire weather alert, once per event type', () => {
    const r = burnWindowRestrictions({
      ...base,
      alerts: [alert('Red Flag Warning'), alert('Red Flag Warning'), alert('Wind Advisory')],
    });
    expect(r.vetoes).toEqual([{ message: 'NWS Red Flag Warning in effect', until: null }]);
    expect(r.notes).toEqual([]);
  });

  it('vetoes on a ban that does not exempt certified burn managers', () => {
    const r = burnWindowRestrictions({ ...base, burnBanStatus: ban('restricted', 'Hinds County burn ban — certified burn managers NOT exempt') });
    expect(r.vetoes).toEqual([{ message: 'Hinds County burn ban — certified burn managers NOT exempt', until: null }]);
  });

  it('notes, but does not veto, an exempting ban or an unknown ban status', () => {
    expect(burnWindowRestrictions({ ...base, burnBanStatus: ban('warning') })).toEqual({ vetoes: [], notes: ['warning message'] });
    expect(burnWindowRestrictions({ ...base, burnBanStatus: ban('unknown') })).toEqual({ vetoes: [], notes: ['unknown message'] });
  });

  it('says the ban check is still running before the first answer', () => {
    const r = burnWindowRestrictions({ ...base, burnBanStatus: ban('unknown'), burnBansLoaded: false });
    expect(r.notes).toEqual(['Checking county burn bans…']);
  });

  it('fails closed when the NWS alert check failed', () => {
    const r = burnWindowRestrictions({ ...base, alertsAvailable: false });
    expect(r.notes).toEqual(['NWS alerts could not be checked — verify at weather.gov']);
  });
});

describe('vetoesForWindow', () => {
  const base = { alerts: [], alertsAvailable: true, burnBanStatus: ban('none'), burnBansLoaded: true };
  const t = (iso: string) => Date.parse(iso);
  // Live NWS Red Flag Warning for Jackson, 2026-10-17: expires 3:45 PM, ends 7 PM CDT
  const rfw = alert('Red Flag Warning', '2026-10-17T19:00:00-05:00', '2026-10-17T15:45:00-05:00');

  it("covers windows that start before the alert's end, not later ones", () => {
    const r = burnWindowRestrictions({ ...base, alerts: [rfw] });
    expect(vetoesForWindow(r, t('2026-10-17T16:00:00-05:00'))).toHaveLength(1); // after expires, before ends
    expect(vetoesForWindow(r, t('2026-10-17T18:00:00-05:00'))).toHaveLength(1);
    expect(vetoesForWindow(r, t('2026-10-17T19:00:00-05:00'))).toHaveLength(0);
    expect(vetoesForWindow(r, t('2026-10-18T11:00:00-05:00'))).toHaveLength(0);
  });

  it('covers every window when the alert has no usable end time', () => {
    for (const ends of [null, '', 'not a date']) {
      const r = burnWindowRestrictions({ ...base, alerts: [alert('Fire Weather Watch', ends)] });
      expect(vetoesForWindow(r, t('2026-10-20T11:00:00-05:00'))).toHaveLength(1);
    }
  });

  it('keeps the latest end when the same event is issued more than once', () => {
    const later = alert('Red Flag Warning', '2026-10-18T19:00:00-05:00');
    const r = burnWindowRestrictions({ ...base, alerts: [rfw, later] });
    expect(r.vetoes).toEqual([{ message: 'NWS Red Flag Warning in effect', until: t('2026-10-18T19:00:00-05:00') }]);
    const open = burnWindowRestrictions({ ...base, alerts: [rfw, alert('Red Flag Warning', null)] });
    expect(open.vetoes[0].until).toBeNull();
  });

  it('a ban covers every window', () => {
    const r = burnWindowRestrictions({ ...base, alerts: [rfw], burnBanStatus: ban('restricted', 'ban') });
    expect(vetoesForWindow(r, t('2026-10-20T11:00:00-05:00')).map((v) => v.message)).toEqual(['ban']);
  });
});
