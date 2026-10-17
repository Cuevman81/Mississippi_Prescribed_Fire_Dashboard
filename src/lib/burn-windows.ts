// ============================================================
// Shared rules for the burn-window finders and the heatmap:
// which prescription limits an hour breaks, and which NWS veto
// alerts or county burn bans override a window that otherwise
// fits the prescription.
// ============================================================

import type { AlertInfo, HourlyForecast, PrescriptionParams } from './types';
import { CRITICAL_FIRE_ALERTS } from './constants';
import type { LocationBanStatus } from './burn-bans';

/** Short labels for each prescription limit an hour falls outside of (empty = within Rx) */
export function rxViolations(
  h: Pick<HourlyForecast, 'temp' | 'humidity' | 'windSpeed' | 'ventilationIndex'>,
  rx: PrescriptionParams
): string[] {
  const reasons: string[] = [];
  if (h.temp < rx.tempMin) reasons.push('Low Temp');
  if (h.temp > rx.tempMax) reasons.push('High Temp');
  if (h.humidity < rx.humidityMin) reasons.push('Low RH');
  if (h.humidity > rx.humidityMax) reasons.push('High RH');
  if (h.windSpeed < rx.windSpeedMin) reasons.push('Low Wind');
  if (h.windSpeed > rx.windSpeedMax) reasons.push('High Wind');
  if (h.ventilationIndex < rx.minVentilationIndex) reasons.push('Low VI');
  return reasons;
}

export interface Veto {
  message: string;
  /** When an NWS alert's hazard ends (ms). Null for bans and for alerts
   *  without an end time: those cover every window. */
  until: number | null;
}

export interface WindowRestrictions {
  /** Burning is off: an active NWS veto alert, or a ban that doesn't exempt certified burn managers */
  vetoes: Veto[];
  /** Not a veto, but the burner must check before relying on a window */
  notes: string[];
}

/**
 * What overrides the forecast windows right now. An NWS veto alert covers
 * every window that starts before the hazard's `ends` time (never the
 * earlier `expires`, which is only when the message lapses). A burn ban is
 * current status with no end date, so it covers every window.
 */
export function burnWindowRestrictions(opts: {
  alerts: AlertInfo[];
  alertsAvailable: boolean;
  burnBanStatus: LocationBanStatus;
  /** false while the first burn ban check is still in flight */
  burnBansLoaded: boolean;
}): WindowRestrictions {
  const { alerts, alertsAvailable, burnBanStatus, burnBansLoaded } = opts;
  const notes: string[] = [];

  // One veto per event type, lasting as long as its latest-ending alert
  const byEvent = new Map<string, number | null>();
  for (const a of alerts) {
    if (!(CRITICAL_FIRE_ALERTS as readonly string[]).includes(a.event)) continue;
    const parsed = a.ends ? Date.parse(a.ends) : NaN;
    const ends = Number.isNaN(parsed) ? null : parsed;
    const prev = byEvent.get(a.event);
    if (prev === undefined) byEvent.set(a.event, ends);
    else if (prev !== null) byEvent.set(a.event, ends === null ? null : Math.max(prev, ends));
  }
  const vetoes: Veto[] = [...byEvent].map(([event, until]) => ({ message: `NWS ${event} in effect`, until }));
  if (!alertsAvailable) notes.push('NWS alerts could not be checked — verify at weather.gov');

  switch (burnBanStatus.effect) {
    case 'restricted':
      vetoes.push({ message: burnBanStatus.message, until: null });
      break;
    case 'warning':
      notes.push(burnBanStatus.message);
      break;
    case 'unknown':
      notes.push(burnBansLoaded ? burnBanStatus.message : 'Checking county burn bans…');
      break;
  }

  return { vetoes, notes };
}

/** The vetoes that cover a window starting at `windowStart` (ms) */
export function vetoesForWindow(restrictions: WindowRestrictions, windowStart: number): Veto[] {
  return restrictions.vetoes.filter((v) => v.until === null || windowStart < v.until);
}
