'use client';

import dynamic from 'next/dynamic';
import { Ban, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';
import {
  BAN_COLORS,
  CERTIFIED_BURN_MANAGER_EXEMPTION,
  EXEMPTION_LABELS,
  banSeverity,
  formatBanTime,
  type BannedCounty,
} from '@/lib/burn-bans';

const BurnBanMap = dynamic(() => import('@/components/maps/BurnBanMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse rounded-lg" />,
});

const GROUPS = [
  { key: 'restricted', title: 'Certified burn managers NOT exempt' },
  { key: 'exempt', title: 'Certified burn managers exempt' },
  { key: 'unknown', title: 'Exemptions unknown' },
] as const;

function SourceLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 underline underline-offset-2">
      Mississippi Forestry Commission <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function ExemptionChips({ ban }: { ban: BannedCounty }) {
  if (ban.mfcBan) return <span className="text-[10px] font-bold text-red-700">MFC ban: no exemptions</span>;
  if (ban.exemptions === null) return <span className="text-[10px] text-slate-500">exemptions unknown</span>;
  if (!ban.exemptions.length) return <span className="text-[10px] font-bold text-red-700">No exemptions</span>;
  return (
    <span className="flex gap-0.5" aria-label={`Exemptions: ${ban.exemptions.map((n) => EXEMPTION_LABELS[n]).join(', ')}`}>
      {ban.exemptions.map((n) => (
        <span
          key={n}
          title={EXEMPTION_LABELS[n]}
          className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${
            n === CERTIFIED_BURN_MANAGER_EXEMPTION ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-700'
          }`}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

/** Statewide list of MFC county burn bans with a highlight map */
export function BurnBanCard() {
  const { burnBans, burnBanStatus } = useDashboard();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
          <Ban className="h-4 w-4 text-red-600" />
          Current Mississippi County Burn Bans
          {burnBans?.available && (
            <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
              {burnBans.bannedCounties.length} of 82 counties
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!burnBans ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking burn bans…
          </p>
        ) : !burnBans.available ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
            <p className="font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Burn ban status unavailable
            </p>
            <p className="mt-1 text-xs">
              The Mississippi Forestry Commission burn ban data could not be reached, so this dashboard cannot say
              whether any county is under a ban. Check the <SourceLink href={burnBans.source} /> before burning.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3 text-sm">
              <p className="text-xs text-slate-500">
                As of {formatBanTime(burnBans.asOf)} · Source: <SourceLink href={burnBans.source} />
              </p>

              {burnBans.stale && (
                <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-900" role="alert">
                  MFC has not updated this data in over a day. It may be out of date; verify at mfc.ms.gov.
                </p>
              )}
              {!burnBans.exemptionsAvailable && (
                <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-900" role="alert">
                  MFC&apos;s exemption data could not be read. Check each county&apos;s order for exemptions.
                </p>
              )}

              {burnBans.bannedCounties.length === 0 ? (
                <p className="font-semibold text-green-800">No Mississippi county is under an MFC-approved burn ban.</p>
              ) : (
                GROUPS.map(({ key, title }) => {
                  const list = burnBans.bannedCounties.filter((b) => banSeverity(b) === key);
                  if (!list.length) return null;
                  return (
                    <div key={key}>
                      <p className="mb-1 flex items-center gap-2 text-xs font-bold text-slate-700">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: BAN_COLORS[key] }} />
                        {title} ({list.length})
                      </p>
                      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                        {list.map((b) => {
                          const isHere = burnBanStatus.county?.toLowerCase() === b.name.toLowerCase();
                          return (
                            <li
                              key={b.name}
                              className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 ${isHere ? 'bg-orange-100 ring-1 ring-orange-400 font-bold' : ''}`}
                            >
                              <span className="truncate">{b.name}{isHere && ' (your location)'}</span>
                              <ExemptionChips ban={b} />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}

              <div className="border-t pt-2 text-[11px] text-slate-500 space-y-1">
                <p>
                  <span className="font-semibold">Exemption key: </span>
                  {Object.entries(EXEMPTION_LABELS).map(([n, label]) => `${n} ${label}`).join(' · ')}.
                  {' '}Exemption 6 (&quot;Other&quot;) is not in MFC&apos;s data feed; check the county order.
                </p>
                <p>
                  Bans are ordered by county Boards of Supervisors under Miss. Code § 49-19-351 and cover unincorporated
                  areas. The statute has no blanket exemption for prescribed burning: a certified burn manager may burn
                  only where that county&apos;s order lists exemption 2, under an MFC burn permit. Expiry dates are on
                  the MFC order, not in this feed. Statewide (Governor&apos;s) bans are proclaimed separately and may
                  have no exemptions.
                </p>
              </div>
            </div>
            <div className="relative h-[340px] w-full rounded-lg overflow-hidden border">
              <BurnBanMap />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
