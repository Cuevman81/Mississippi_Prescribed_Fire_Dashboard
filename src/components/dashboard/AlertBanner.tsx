'use client';

import { AlertTriangle, Ban, Flame, Droplets } from 'lucide-react';
import { useDashboard } from '@/lib/dashboard-context';
import { CRITICAL_FIRE_ALERTS, FUEL_MOISTURE_1HR, KBDI_SEVERE } from '@/lib/constants';

export function AlertBanner() {
  const { alerts, burnBanInfo, forecast, currentForecastIdx, kbdi } = useDashboard();

  const current = forecast[currentForecastIdx] || forecast[0];
  // Ignition alerts keyed to fine dead fuel moisture (Simard EMC):
  // southern Rx guides treat fine fuels below ~6% as spotting territory
  const fm1 = current?.fuelMoisture1hr;
  const isExtremeIgnition = fm1 != null && fm1 < FUEL_MOISTURE_1HR.EXTREME;
  const isElevatedIgnition = fm1 != null && !isExtremeIgnition && fm1 < FUEL_MOISTURE_1HR.ELEVATED;
  // Real KBDI (Keetch & Byram 1968, computed from observed climate data)
  const isSevereDrought = kbdi != null && kbdi.kbdi > KBDI_SEVERE;

  if (!alerts.length && !burnBanInfo && !isExtremeIgnition && !isElevatedIgnition && !isSevereDrought) return null;

  return (
    <div className="space-y-2 mb-4">
      {isExtremeIgnition && (
        <div className="bg-red-600 border border-red-800 text-white rounded-lg p-3 flex items-start gap-3 shadow-md animate-pulse">
          <Flame className="h-5 w-5 text-red-100 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">EXTREME IGNITION POTENTIAL</p>
            <p className="text-red-100 text-xs mt-1">
              Fine dead fuel moisture is critically low ({fm1}%). Spotting and erratic fire behavior are likely. Southern Rx guidelines recommend fine fuel moisture of 7-20% for prescribed burning.
            </p>
          </div>
        </div>
      )}

      {isElevatedIgnition && (
        <div className="bg-orange-500 border border-orange-700 text-white rounded-lg p-3 flex items-start gap-3 shadow-sm">
          <Flame className="h-5 w-5 text-orange-100 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Low Fine Fuel Moisture</p>
            <p className="text-orange-100 text-xs mt-1">
              Fine dead fuel moisture ({fm1}%) is below the 7% floor recommended for southern prescribed burns. Expect fast ignition and possible spot fires.
            </p>
          </div>
        </div>
      )}

      {isSevereDrought && kbdi && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
          <Droplets className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">Severe Drought — KBDI {kbdi.kbdi}</p>
            <p className="text-orange-700 text-xs mt-1">
              {kbdi.description} (Observed KBDI as of {kbdi.asOfDate}.)
            </p>
          </div>
        </div>
      )}

      {alerts.map((alert, i) => {
        const isCriticalFire = (CRITICAL_FIRE_ALERTS as readonly string[]).includes(alert.event);

        if (isCriticalFire) {
          return (
            <div
              key={i}
              className="bg-gradient-to-r from-red-600 to-orange-600 border-2 border-red-900 text-white rounded-lg p-4 flex items-start gap-4 shadow-xl animate-pulse ring-4 ring-red-500/20"
            >
              <div className="bg-white/20 p-2 rounded-full">
                <Flame className="h-6 w-6 text-white flex-shrink-0" />
              </div>
              <div className="flex-1">
                <p className="font-black text-lg tracking-tight uppercase italic flex items-center gap-2">
                  CRITICAL FIRE WEATHER ALERT: {alert.event}
                </p>
                <p className="text-red-50 text-sm font-bold mt-1 leading-tight">
                  {alert.headline}
                </p>
                <div className="mt-2 text-xs bg-black/20 p-2 rounded border border-white/10 italic">
                  Prescribed burns are NOT RECOMMENDED. Critical fire spread risks detected by NWS.
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={i}
            className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 shadow-sm"
          >
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">{alert.event}</p>
              <p className="text-red-700 text-xs mt-1">{alert.headline}</p>
            </div>
          </div>
        );
      })}
      {burnBanInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
          <Ban className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Burn Ban Notice</p>
            <p className="text-amber-700 text-xs mt-1 whitespace-pre-wrap line-clamp-3">
              {burnBanInfo.slice(0, 300)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
