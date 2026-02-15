'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/lib/dashboard-context';
import { getDispersionColor } from '@/lib/constants';
import { formatNumber } from '@/lib/weather-utils';

export function SmokeDispersion() {
  const { forecast, currentForecastIdx } = useDashboard();
  const current = forecast[currentForecastIdx] || forecast[0];

  if (!current) return null;

  const color = getDispersionColor(current.dispersionCategory);

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          Smoke Dispersion Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Badge
            className="text-white text-lg px-4 py-1.5 font-bold"
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
  );
}
