'use client';

import { Thermometer, Droplets, Wind, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';
import { formatNumber } from '@/lib/weather-utils';

export function CurrentConditions() {
  const { forecast, currentForecastIdx, stationObservation } = useDashboard();

  // Use the forecast hour closest to now (not forecast[0] which may be stale)
  const nowForecast = forecast[currentForecastIdx] || forecast[0];

  // Use real-time station data if available, otherwise nearest-to-now forecast hour
  const current = stationObservation || (nowForecast ? {
    temp: nowForecast.temp,
    humidity: nowForecast.humidity,
    windSpeed: nowForecast.windSpeed,
    windDirectionCardinal: nowForecast.windDirectionCardinal,
    windGust: nowForecast.windGust,
  } : null);

  const vi = nowForecast?.ventilationIndex ?? 0;

  if (!current && !forecast.length) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-white">
            <CardContent className="p-4">
              <div className="h-16 flex items-center justify-center text-slate-300 text-sm">
                Enter location to see conditions
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      label: 'Temperature',
      value: current?.temp != null ? `${Math.round(current.temp)}°F` : '--',
      icon: Thermometer,
      color: getColor('temp', current?.temp),
    },
    {
      label: 'Humidity',
      value: current?.humidity != null ? `${Math.round(current.humidity)}%` : '--',
      icon: Droplets,
      color: getColor('humidity', current?.humidity),
    },
    {
      label: 'Wind',
      value: current?.windSpeed != null
        ? `${current.windDirectionCardinal || ''} ${Math.round(current.windSpeed)} mph`
        : '--',
      icon: Wind,
      color: getColor('wind', current?.windSpeed),
      sub: current?.windGust && current.windGust > (current?.windSpeed || 0) + 5
        ? `Gusts: ${Math.round(current.windGust)} mph`
        : undefined,
    },
    {
      label: 'Ventilation Index',
      value: vi ? formatNumber(vi) : '--',
      icon: ArrowUpDown,
      color: getColor('vi', vi),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-500 font-medium">{item.label}</span>
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              {item.sub && (
                <p className="text-xs text-orange-600 mt-1">{item.sub}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
      {stationObservation && (
        <p className="col-span-2 lg:col-span-4 text-xs text-slate-400 -mt-2">
          Real-time from {stationObservation.stationName} ({stationObservation.stationId}) — {stationObservation.distanceMiles} mi away
        </p>
      )}
      {!stationObservation && nowForecast && (
        <p className="col-span-2 lg:col-span-4 text-xs text-orange-500 -mt-2">
          Showing NWS forecast data for {new Date(nowForecast.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} (real-time station unavailable)
        </p>
      )}
    </div>
  );
}

function getColor(type: string, value?: number | null): string {
  if (value == null) return 'text-slate-900';

  switch (type) {
    case 'temp':
      if (value >= 40 && value <= 80) return 'text-green-600';
      if (value > 80 || value < 40) return 'text-orange-600';
      return 'text-red-600';
    case 'humidity':
      if (value >= 30 && value <= 55) return 'text-green-600';
      if (value < 25 || value > 60) return 'text-red-600';
      return 'text-orange-600';
    case 'wind':
      if (value >= 4 && value <= 15) return 'text-green-600';
      if (value > 20) return 'text-red-600';
      return 'text-orange-600';
    case 'vi':
      if (value >= 40000) return 'text-green-600';
      if (value >= 20000) return 'text-yellow-600';
      return 'text-red-600';
    default:
      return 'text-slate-900';
  }
}
