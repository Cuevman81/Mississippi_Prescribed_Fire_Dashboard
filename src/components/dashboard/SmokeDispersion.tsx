'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/lib/dashboard-context';
import { getDispersionColor } from '@/lib/constants';
import { formatNumber } from '@/lib/weather-utils';
import { motion } from 'framer-motion';

export function SmokeDispersion() {
  const { forecast, currentForecastIdx } = useDashboard();
  const current = forecast[currentForecastIdx] || forecast[0];

  if (!current) return null;

  const color = getDispersionColor(current.dispersionCategory);

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
          <div className="flex items-center gap-3">
            <Badge
              className="text-white text-lg px-4 py-1.5 font-bold shadow-sm"
              style={{ backgroundColor: color }}
            >
              {current.dispersionCategory}
            </Badge>
            <span className="text-sm text-slate-500">
              Adj. VI: {formatNumber(current.adjustedVI)}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            {current.dispersionDescription}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
