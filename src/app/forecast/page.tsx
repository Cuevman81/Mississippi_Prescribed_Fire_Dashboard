'use client';

import { useEffect, useRef } from 'react';
import { useDashboard } from '@/lib/dashboard-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2 } from 'lucide-react';
import { getBurnQualityColor } from '@/lib/constants';

export default function ForecastPage() {
  const { forecast, currentForecastIdx, narrativeForecast, fireDiscussion, zoneForecast, isLoading, nwsOffice, location } = useDashboard();
  const currentRowRef = useRef<HTMLTableRowElement>(null);

  // Auto-scroll to the current forecast row on load
  useEffect(() => {
    if (currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentForecastIdx, forecast.length]);

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
        <p className="text-slate-400">Enter a location and get forecast to see detailed data.</p>
      </div>
    );
  }

  const downloadCSV = () => {
    const headers = [
      'Time', 'Temp(F)', 'RH(%)', 'Wind(mph)', 'Gust(mph)', 'Wind Dir',
      'Sky Cover', 'Mix Height(ft)', 'Trans Wind(mph)', 'VI', 'Burn Quality', 'Burn Score',
    ];
    const rows = forecast.map((h) => [
      h.localTime, h.temp, h.humidity, h.windSpeed, h.windGust, h.windDirectionCardinal,
      h.skyCoverAbbr, h.mixingHeight, h.transportWindSpeed, h.ventilationIndex, h.burnQuality, h.burnScore,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast_${location?.city || 'data'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Narrative Forecast */}
      {narrativeForecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Narrative Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {narrativeForecast.slice(0, 4).map((period, i) => (
                <div key={i} className="border rounded-lg p-3">
                  <p className="font-medium text-sm text-slate-700">{period.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{period.detailedForecast}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fire Weather Discussion */}
      {fireDiscussion && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">
              NWS Fire Weather Discussion ({nwsOffice})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded">
              {fireDiscussion}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Zone Forecast */}
      {zoneForecast && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Zone-Specific Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded max-h-64 overflow-auto">
              {zoneForecast}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Forecast Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-500">72-Hour Forecast</CardTitle>
          <Button size="sm" variant="outline" onClick={downloadCSV}>
            <Download className="h-3 w-3 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b bg-slate-50">
                  {['Time', 'Temp', 'RH%', 'Wind', 'Gust', 'Dir', 'Sky', 'Wx',
                    'Mix Ht', 'Trans', 'VI', 'Quality'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-medium text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecast.map((h, i) => {
                  const color = getBurnQualityColor(h.burnScore);
                  const isCurrent = i === currentForecastIdx;
                  return (
                    <tr
                      key={i}
                      ref={isCurrent ? currentRowRef : undefined}
                      className={`border-b hover:bg-slate-50 ${isCurrent ? 'bg-orange-50 font-medium' : i < currentForecastIdx ? 'opacity-40' : ''}`}
                      style={{ borderLeftWidth: 3, borderLeftColor: color }}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap font-medium">
                        {isCurrent && <span className="text-orange-600 mr-1">&#9658;</span>}
                        {new Date(h.time).toLocaleString('en-US', {
                          weekday: 'short', hour: 'numeric', hour12: true,
                        })}
                      </td>
                      <td className="px-2 py-1.5">{h.temp}°F</td>
                      <td className="px-2 py-1.5">{h.humidity}%</td>
                      <td className="px-2 py-1.5">{h.windSpeed}</td>
                      <td className="px-2 py-1.5">{h.windGust}</td>
                      <td className="px-2 py-1.5">{h.windDirectionCardinal}</td>
                      <td className="px-2 py-1.5">{h.skyCoverAbbr}</td>
                      <td className="px-2 py-1.5">{h.weatherAbbr || '-'}</td>
                      <td className="px-2 py-1.5">{h.mixingHeight.toLocaleString()}</td>
                      <td className="px-2 py-1.5">{h.transportWindSpeed}</td>
                      <td className="px-2 py-1.5">{h.ventilationIndex.toLocaleString()}</td>
                      <td className="px-2 py-1.5">
                        <Badge
                          className="text-white text-[10px] px-1.5"
                          style={{ backgroundColor: color }}
                        >
                          {h.burnQuality}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
