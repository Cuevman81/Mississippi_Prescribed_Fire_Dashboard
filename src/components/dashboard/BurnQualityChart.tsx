'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';
import { getBurnQualityColor } from '@/lib/constants';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

export function BurnQualityChart() {
  const { forecast, currentForecastIdx } = useDashboard();

  if (!forecast.length) return null;

  // Show next 24 hours starting from current time
  const data = forecast.slice(currentForecastIdx, currentForecastIdx + 24).map((h) => {
    const d = new Date(h.time);
    return {
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
      score: h.burnScore,
      quality: h.burnQuality,
      color: getBurnQualityColor(h.burnScore),
    };
  });

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          Burn Quality — Next 24 Hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border rounded-lg shadow-lg p-2 text-sm">
                    <p className="font-medium">{d.time}</p>
                    <p style={{ color: d.color }} className="font-bold">
                      {d.quality} ({d.score})
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" />
            <ReferenceLine y={50} stroke="#eab308" strokeDasharray="3 3" />
            <Bar dataKey="score" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-600 inline-block" /> Excellent/Good
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> Fair
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-500 inline-block" /> Marginal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-600 inline-block" /> Poor
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
