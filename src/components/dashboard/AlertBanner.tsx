'use client';

import { AlertTriangle, Ban } from 'lucide-react';
import { useDashboard } from '@/lib/dashboard-context';

export function AlertBanner() {
  const { alerts, burnBanInfo } = useDashboard();

  if (!alerts.length && !burnBanInfo) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">{alert.event}</p>
            <p className="text-red-700 text-xs mt-1">{alert.headline}</p>
          </div>
        </div>
      ))}
      {burnBanInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
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
