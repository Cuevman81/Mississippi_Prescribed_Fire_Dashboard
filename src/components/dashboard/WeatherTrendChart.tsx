'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export function WeatherTrendChart() {
  const { forecast, currentForecastIdx } = useDashboard();

  if (!forecast.length) return null;

  // Show 48 hours starting from current time
  const data = forecast.slice(currentForecastIdx, currentForecastIdx + 48).map((h) => {
    const d = new Date(h.time);
    return {
      time: d.toLocaleString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        hour12: true,
      }),
      temp: h.temp,
      humidity: h.humidity,
      wind: h.windSpeed,
    };
  });

  return (
    <Card className="bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          Weather Trends — Next 48 Hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10 }}
              interval={5}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border rounded-lg shadow-lg p-2 text-sm">
                    <p className="font-medium mb-1">{label}</p>
                    {payload.map((p, i) => (
                      <p key={i} style={{ color: p.color }}>
                        {p.name}: {p.value}
                        {p.name === 'Temperature' ? '°F' : p.name === 'Humidity' ? '%' : ' mph'}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="temp"
              name="Temperature"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="humidity"
              name="Humidity"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="wind"
              name="Wind Speed"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
