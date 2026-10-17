'use client';

import { useMemo } from 'react';
import { Ban, AlertTriangle } from 'lucide-react';
import { useDashboard } from '@/lib/dashboard-context';
import { burnWindowRestrictions, type WindowRestrictions } from '@/lib/burn-windows';

/** Veto alerts, county burn bans and unconfirmed checks that override the forecast windows */
export function useWindowRestrictions(): WindowRestrictions {
  const { alerts, alertsAvailable, burnBans, burnBanStatus } = useDashboard();
  const burnBansLoaded = burnBans !== null;
  return useMemo(
    () => burnWindowRestrictions({ alerts, alertsAvailable, burnBanStatus, burnBansLoaded }),
    [alerts, alertsAvailable, burnBanStatus, burnBansLoaded]
  );
}

/** Shown above the burn windows; renders nothing when no veto or note applies */
export function WindowRestrictionsNotice({ restrictions }: { restrictions: WindowRestrictions }) {
  const { timezone } = useDashboard();
  const { vetoes, notes } = restrictions;
  if (!vetoes.length && !notes.length) return null;
  const allTimed = vetoes.every((v) => v.until !== null);
  const until = (ms: number) => new Date(ms).toLocaleString('en-US', {
    timeZone: timezone, weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  return (
    <div className="space-y-2 mb-4">
      {vetoes.length > 0 && (
        <div role="alert" className="rounded-lg border-2 border-red-700 bg-red-600 text-white p-3 text-sm">
          <p className="flex items-center gap-2 font-black uppercase tracking-tight">
            <Ban className="h-5 w-5 flex-shrink-0" />
            Burn vetoed — windows marked Vetoed can&apos;t be used
          </p>
          <ul className="mt-1 font-semibold list-disc pl-6">
            {vetoes.map((v) => (
              <li key={v.message}>{v.message}{v.until !== null && ` until ${until(v.until)}`}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs opacity-90">
            {allTimed
              ? 'Windows that start after the alert ends are not marked, but NWS can extend an alert: check again before ignition.'
              : 'The windows below meet your weather prescription only. Every one of them is vetoed until the alert or ban is lifted.'}
          </p>
        </div>
      )}
      {notes.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-400 bg-amber-50 text-amber-900 p-3 text-xs">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
            Check before relying on these windows
          </p>
          <ul className="mt-1 list-disc pl-6">
            {notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Small tag for a window card that is vetoed */
export function VetoedTag() {
  return (
    <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">
      <Ban className="h-3 w-3" /> Vetoed
    </span>
  );
}
