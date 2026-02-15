'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';
import { formatNumber, formatWind } from '@/lib/weather-utils';
import { FFMC_THRESHOLDS } from '@/lib/constants';

export function FireIndices() {
  const { forecast, currentForecastIdx } = useDashboard();
  const current = forecast[currentForecastIdx] || forecast[0];

  if (!current) return null;

  const indices = [
    {
      label: 'Surface Wind',
      value: formatWind(current.windDirectionCardinal, current.windSpeed, current.windGust),
      warn: current.windGust > 25 ? 'Gusts >25 mph' : undefined,
    },
    {
      label: 'Transport Wind',
      value: `${current.transportWindDirectionCardinal} ${current.transportWindSpeed} mph (${current.transportWindSpeedMs} m/s)`,
    },
    {
      label: 'Mixing Height',
      value: `${formatNumber(current.mixingHeight)} ft`,
    },
    {
      label: 'Haines Index',
      value: `${current.hainesIndex}`,
      warn: current.hainesIndex >= 5 ? 'Elevated fire potential' : undefined,
    },
    {
      label: 'Precip Chance',
      value: `${current.precipChance}%`,
      show: current.precipChance > 0,
    },
    {
      label: 'KBDI Trend',
      value: `${current.kbdiTrend}`,
    },
    {
      label: 'FFMC',
      value: `${current.ffmc}`,
      warn: current.ffmc >= FFMC_THRESHOLDS.EXTREME
        ? 'EXTREME ignition potential'
        : current.ffmc >= FFMC_THRESHOLDS.VERY_HIGH
          ? 'Very high ignition potential'
          : undefined,
    },
    {
      label: '1-Hr Fuel Moisture',
      value: `${current.fuelMoisture1hr}%`,
    },
    {
      label: '10-Hr Fuel Moisture',
      value: `${current.fuelMoisture10hr}%`,
    },
    {
      label: '100-Hr Fuel Moisture',
      value: `${current.fuelMoisture100hr}%`,
    },
    {
      label: 'Ignition Probability',
      value: `${current.ignitionProbability}%`,
    },
  ];

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          Fire Weather Indices
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
          {indices.filter((i) => i.show !== false).map((item) => (
            <div key={item.label}>
              <p className="text-xs text-slate-400 font-medium">{item.label}</p>
              <p className="text-sm font-semibold text-slate-900">{item.value}</p>
              {item.warn && (
                <p className="text-xs text-red-600 font-medium">{item.warn}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
