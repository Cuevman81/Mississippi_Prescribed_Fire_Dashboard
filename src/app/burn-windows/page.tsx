'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useDashboard } from '@/lib/dashboard-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, CheckCircle } from 'lucide-react';
import { getBurnQualityColor } from '@/lib/constants';
import { formatNumber } from '@/lib/weather-utils';
import type { BurnWindow, HourlyForecast } from '@/lib/types';

export default function BurnWindowsPage() {
  const { forecast, currentForecastIdx, prescription, timezone, isLoading } = useDashboard();
  const [hoveredCell, setHoveredCell] = useState<{
    day: string; hour: number; score: number; quality: string; reasons?: string[];
  } | null>(null);

  // Helper: get local hour from ISO time string using the forecast timezone
  const getLocalHour = useCallback((isoTime: string): number => {
    const d = new Date(isoTime);
    const localStr = d.toLocaleString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    });
    return parseInt(localStr);
  }, [timezone]);

  const getLocalDateLabel = useCallback((isoTime: string): string => {
    return new Date(isoTime).toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, [timezone]);

  // Only consider future forecast hours (from current time forward)
  const futureForecast = useMemo(
    () => forecast.slice(currentForecastIdx),
    [forecast, currentForecastIdx]
  );

  const burnWindows = useMemo(() => {
    if (!futureForecast.length) return [];

    const windows: BurnWindow[] = [];

    // Group by day, filter 10AM-4PM (local time)
    const byDay = new Map<string, HourlyForecast[]>();
    for (const h of futureForecast) {
      const hour = getLocalHour(h.time);
      if (hour < 10 || hour > 16) continue;

      // Check if it meets prescription
      if (
        h.temp >= prescription.tempMin && h.temp <= prescription.tempMax &&
        h.humidity >= prescription.humidityMin && h.humidity <= prescription.humidityMax &&
        h.windSpeed >= prescription.windSpeedMin && h.windSpeed <= prescription.windSpeedMax &&
        h.ventilationIndex >= prescription.minVentilationIndex
      ) {
        const dateKey = getLocalDateLabel(h.time);
        if (!byDay.has(dateKey)) byDay.set(dateKey, []);
        byDay.get(dateKey)!.push(h);
      }
    }

    // Find consecutive windows of >=2 hours per day
    for (const [date, hours] of byDay) {
      if (hours.length < 2) continue;

      hours.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      let currentWindow: HourlyForecast[] = [hours[0]];
      for (let i = 1; i < hours.length; i++) {
        const prevTime = new Date(hours[i - 1].time).getTime();
        const currTime = new Date(hours[i].time).getTime();

        if (currTime - prevTime <= 3600000) {
          currentWindow.push(hours[i]);
        } else {
          if (currentWindow.length >= 2) {
            windows.push(buildWindow(date, currentWindow, timezone));
          }
          currentWindow = [hours[i]];
        }
      }
      if (currentWindow.length >= 2) {
        windows.push(buildWindow(date, currentWindow, timezone));
      }
    }

    return windows;
  }, [futureForecast, prescription, timezone, getLocalDateLabel, getLocalHour]);

  // Build heatmap grid data: days (rows) × hours (columns)
  const { days, heatmapGrid } = useMemo(() => {
    if (!futureForecast.length) return { days: [] as string[], heatmapGrid: new Map<string, Map<number, { score: number; quality: string; reasons: string[] }>>() };

    const grid = new Map<string, Map<number, { score: number; quality: string; reasons: string[] }>>();
    const dayOrder: string[] = [];

    for (const h of futureForecast) {
      const day = getLocalDateLabel(h.time);
      const hour = getLocalHour(h.time);

      if (!grid.has(day)) {
        grid.set(day, new Map());
        dayOrder.push(day);
      }
      
      const reasons: string[] = [];
      if (h.temp < prescription.tempMin) reasons.push('Low Temp');
      if (h.temp > prescription.tempMax) reasons.push('High Temp');
      if (h.humidity < prescription.humidityMin) reasons.push('Low RH');
      if (h.humidity > prescription.humidityMax) reasons.push('High RH');
      if (h.windSpeed < prescription.windSpeedMin) reasons.push('Low Wind');
      if (h.windSpeed > prescription.windSpeedMax) reasons.push('High Wind');
      if (h.ventilationIndex < prescription.minVentilationIndex) reasons.push('Low VI');
      
      grid.get(day)!.set(hour, { score: h.burnScore, quality: h.burnQuality, reasons });
    }

    return { days: dayOrder, heatmapGrid: grid };
  }, [futureForecast, prescription, getLocalDateLabel, getLocalHour]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!forecast.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400">Enter a location and get forecast to see burn windows.</p>
      </div>
    );
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-4">
      {/* Optimal Burn Windows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Optimal Burn Windows (10AM-4PM, within prescription)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {burnWindows.length === 0 ? (
            <p className="text-sm text-slate-500">
              No burn windows found that meet all prescription parameters. Try adjusting your
              thresholds in Rx Parameters.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {burnWindows.map((w, i) => (
                <div
                  key={i}
                  className="border rounded-lg p-3"
                  style={{ borderLeftWidth: 4, borderLeftColor: getBurnQualityColor(w.avgBurnScore) }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{w.date}</p>
                    <Badge
                      className="text-white text-[10px]"
                      style={{ backgroundColor: getBurnQualityColor(w.avgBurnScore) }}
                    >
                      {w.burnQuality}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
                    {w.startTime} - {w.endTime} ({w.hours} hrs)
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                    <span>Avg Temp: {Math.round(w.avgTemp)}°F</span>
                    <span>Avg RH: {Math.round(w.avgHumidity)}%</span>
                    <span>Avg Wind: {Math.round(w.avgWindSpeed)} mph</span>
                    <span>Avg VI: {formatNumber(Math.round(w.avgVentilationIndex))}</span>
                    <span>Surface: {w.prevailingSurfaceWind}</span>
                    <span>Transport: {w.prevailingTransportWind}</span>
                    <span className="col-span-2">Dispersion: {w.dispersionCategory}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Burn Quality Heatmap — CSS Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">
            Burn Quality Heatmap (Score by Day & Hour)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {/* Tooltip */}
            <div className="h-8 mb-2">
              {hoveredCell ? (
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <span className="font-medium">{hoveredCell.day} at {hoveredCell.hour}:00</span>
                  {' — '}
                  <span style={{ color: getBurnQualityColor(hoveredCell.score) }} className="font-bold">
                    {hoveredCell.quality} ({hoveredCell.score})
                  </span>
                  {hoveredCell.reasons && hoveredCell.reasons.length > 0 && (
                    <div className="flex gap-1 ml-2">
                      {hoveredCell.reasons.map((r, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[9px] uppercase font-bold">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Hover over a cell to see details and prescription status</p>
              )}
            </div>

            {/* Hour labels header */}
            <div className="inline-grid gap-[2px]" style={{
              gridTemplateColumns: `100px repeat(24, minmax(24px, 1fr))`,
            }}>
              {/* Header row: hour labels */}
              <div className="text-[10px] text-slate-400 font-medium flex items-end pb-1">Hour →</div>
              {hours.map((h) => (
                <div key={h} className="text-[10px] text-slate-400 text-center pb-1">
                  {h === 0 ? '12A' : h < 12 ? `${h}A` : h === 12 ? '12P' : `${h - 12}P`}
                </div>
              ))}

              {/* Data rows: one per day */}
              {days.map((day) => (
                <React.Fragment key={day}>
                  <div className="text-[11px] text-slate-600 font-medium flex items-center pr-2 whitespace-nowrap">
                    {day}
                  </div>
                  {hours.map((h) => {
                    const cell = heatmapGrid.get(day)?.get(h);
                    return (
                      <div
                        key={`${day}-${h}`}
                        className="aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110 hover:z-10 relative"
                        style={{
                          backgroundColor: cell ? getBurnQualityColor(cell.score) : '#f1f5f9',
                          minHeight: '20px',
                        }}
                        onMouseEnter={() => cell && setHoveredCell({ day, hour: h, score: cell.score, quality: cell.quality, reasons: cell.reasons })}
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#16a34a' }} /> Excellent (90+)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} /> Good (70-89)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }} /> Fair (50-69)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }} /> Marginal (30-49)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }} /> Poor (&lt;30)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-100 border" /> No data
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function buildWindow(date: string, hours: HourlyForecast[], timezone: string): BurnWindow {
  const avgTemp = hours.reduce((s, h) => s + h.temp, 0) / hours.length;
  const avgHum = hours.reduce((s, h) => s + h.humidity, 0) / hours.length;
  const avgWind = hours.reduce((s, h) => s + h.windSpeed, 0) / hours.length;
  const avgVI = hours.reduce((s, h) => s + h.ventilationIndex, 0) / hours.length;
  const avgScore = hours.reduce((s, h) => s + h.burnScore, 0) / hours.length;

  const windCounts = new Map<string, number>();
  const transWindCounts = new Map<string, number>();
  for (const h of hours) {
    windCounts.set(h.windDirectionCardinal, (windCounts.get(h.windDirectionCardinal) || 0) + 1);
    transWindCounts.set(h.transportWindDirectionCardinal, (transWindCounts.get(h.transportWindDirectionCardinal) || 0) + 1);
  }

  const prevailingSurface = [...windCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const prevailingTransport = [...transWindCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  const startD = new Date(hours[0].time);
  const endD = new Date(hours[hours.length - 1].time);

  return {
    date,
    startTime: startD.toLocaleTimeString('en-US', { timeZone: timezone, hour: 'numeric', hour12: true }),
    endTime: endD.toLocaleTimeString('en-US', { timeZone: timezone, hour: 'numeric', hour12: true }),
    hours: hours.length,
    avgTemp,
    avgHumidity: avgHum,
    avgWindSpeed: avgWind,
    avgVentilationIndex: avgVI,
    prevailingSurfaceWind: prevailingSurface,
    prevailingTransportWind: prevailingTransport,
    dispersionCategory: hours[0].dispersionCategory,
    burnQuality: getBurnQualityLabel(avgScore),
    avgBurnScore: Math.round(avgScore),
  };
}

function getBurnQualityLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Marginal';
  return 'Poor';
}
