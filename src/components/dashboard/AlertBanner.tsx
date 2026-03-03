'use client';

import { AlertTriangle, Ban, Flame } from 'lucide-react';
import { useDashboard } from '@/lib/dashboard-context';
import { FFMC_THRESHOLDS } from '@/lib/constants';

export function AlertBanner() {
  const { alerts, burnBanInfo, forecast, currentForecastIdx } = useDashboard();

  const current = forecast[currentForecastIdx] || forecast[0];
  const isExtremeIgnition = current?.ffmc >= FFMC_THRESHOLDS.EXTREME;
  const isVeryHighIgnition = current?.ffmc >= FFMC_THRESHOLDS.VERY_HIGH && current?.ffmc < FFMC_THRESHOLDS.EXTREME;
  const isHighKBDI = current?.kbdiTrend > 600;

  if (!alerts.length && !burnBanInfo && !isExtremeIgnition && !isVeryHighIgnition && !isHighKBDI) return null;

  return (
    <div className="space-y-2 mb-4">
      {isExtremeIgnition && (
        <div className="bg-red-600 border border-red-800 text-white rounded-lg p-3 flex items-start gap-3 shadow-md animate-pulse">
          <Flame className="h-5 w-5 text-red-100 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">EXTREME IGNITION POTENTIAL!</p>
            <p className="text-red-100 text-xs mt-1">
              Fine Fuel Moisture Code (FFMC) is critically high ({current.ffmc}). Any ignition source will likely result in rapid fire spread. EXTREME CAUTION ADVISED.
            </p>
          </div>
        </div>
      )}

      {isVeryHighIgnition && (
        <div className="bg-orange-500 border border-orange-700 text-white rounded-lg p-3 flex items-start gap-3 shadow-sm">
          <Flame className="h-5 w-5 text-orange-100 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Very High Ignition Potential</p>
            <p className="text-orange-100 text-xs mt-1">
              FFMC is very high ({current.ffmc}). Spot fires are highly probable.
            </p>
          </div>
        </div>
      )}

      {isHighKBDI && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800 text-sm">Severe Drought Condition</p>
            <p className="text-orange-700 text-xs mt-1">
              KBDI is extremely high ({current.kbdiTrend}). Ground fuels and heavy timber are critically dry and will contribute significantly to fire intensity.
            </p>
          </div>
        </div>
      )}

      {alerts.map((alert, i) => (
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
      ))}
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
