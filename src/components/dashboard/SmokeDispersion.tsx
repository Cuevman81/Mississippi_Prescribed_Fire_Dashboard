'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/lib/dashboard-context';
import { getDispersionColor } from '@/lib/constants';
import { formatNumber } from '@/lib/weather-utils';
import { lvoriGuidance } from '@/lib/dispersion';
import { motion } from 'framer-motion';
import { Moon, TriangleAlert } from 'lucide-react';

export function SmokeDispersion() {
  const { forecast, currentForecastIdx } = useDashboard();
  const current = forecast[currentForecastIdx] || forecast[0];

  if (!current) return null;

  const color = getDispersionColor(current.dispersionCategory);

  // Worst LVORI over the coming night hours (residual-smoke risk window)
  const next24 = forecast.slice(currentForecastIdx, currentForecastIdx + 24);
  const nightHours = next24.filter((h) => !h.isDay);
  const peakNightLvori = nightHours.length
    ? Math.max(...nightHours.map((h) => h.lvori))
    : current.lvori;
  const guidance = lvoriGuidance(peakNightLvori);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1, duration: 0.4 }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">
            Smoke Dispersion Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              className="text-white text-lg px-4 py-1.5 font-bold shadow-sm"
              style={{ backgroundColor: color }}
            >
              {current.dispersionCategory}
            </Badge>
            <span className="text-sm text-slate-500">
              VI: {formatNumber(current.ventilationIndex)}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            {current.dispersionDescription}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-400 font-medium">Dispersion Index (Lavdas)</p>
              <p className="text-sm font-semibold text-slate-900">
                {current.adi} <span className="font-normal text-slate-500">— {current.adiCategory}</span>
              </p>
              <p className="text-[10px] text-slate-400">Stability class {current.stabilityClass} ({current.isDay ? 'day' : 'night'})</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Moon className="h-3 w-3" /> Overnight LVORI (peak)
              </p>
              <p className={`text-sm font-semibold ${guidance.level === 'danger' ? 'text-red-600' : guidance.level === 'caution' ? 'text-amber-600' : 'text-slate-900'}`}>
                {peakNightLvori} / 10
              </p>
            </div>
          </div>

          {guidance.level !== 'ok' && (
            <div className={`mt-3 text-xs rounded-md p-2 flex items-start gap-2 ${guidance.level === 'danger' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              <TriangleAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <b>Night smoke/fog risk:</b> {guidance.text}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
