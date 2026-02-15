'use client';

import { useDashboard } from '@/lib/dashboard-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Wind } from 'lucide-react';
import { getAQIColor, getAQITextColor, getAQIRecommendation, shouldAvoidBurning } from '@/lib/aqi-utils';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

const MonitorMap = dynamic(() => import('@/components/maps/MonitorMap'), { ssr: false });

export default function AirQualityPage() {
  const { currentAQI, aqiForecast, aqiMonitors, isLoading, location } = useDashboard();

  // Separate forecasts by date
  const { today, tomorrowDate } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return { today: todayStr, tomorrowDate: tomorrowStr };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400">Enter a location and get forecast to see air quality data.</p>
      </div>
    );
  }

  // Safe accessor for category name (defense against API returning unexpected shapes)
  const getCategoryName = (obs: { category?: { name?: string } }): string =>
    obs?.category?.name ?? 'Unknown';

  const todayForecast = aqiForecast.filter((f) => f.dateForecast === today);
  const tomorrowForecast = aqiForecast.filter((f) => f.dateForecast === tomorrowDate);

  // Check if burning should be avoided
  const maxAQI = Math.max(...currentAQI.map((a) => a.aqi), 0);
  const burnAdvice = shouldAvoidBurning(maxAQI);

  return (
    <div className="space-y-4">
      {/* Burn advice banner */}
      {burnAdvice.avoid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm font-medium text-red-800">
            <Wind className="h-4 w-4 inline mr-1" />
            {burnAdvice.reason}
          </p>
        </div>
      )}
      {!burnAdvice.avoid && burnAdvice.reason && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">{burnAdvice.reason}</p>
        </div>
      )}

      {/* Current AQI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">
            Current Air Quality — {location.city}, {location.stateAbbr}
          </CardTitle>
          {currentAQI.length > 0 && currentAQI[0].dateObserved && (
            <p className="text-[11px] text-slate-400 mt-1">
              Observed: {(() => {
                const obs = currentAQI[0];
                const hour = Number(obs.hourObserved) || 0;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                // Parse date string (YYYY-MM-DD format from our normalized API)
                const dateParts = String(obs.dateObserved).split('-');
                let dateLabel = String(obs.dateObserved);
                if (dateParts.length === 3) {
                  const d = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
                  dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }
                return `${dateLabel} at ${h12}:00 ${ampm} ${obs.localTimeZone || 'Local'}`;
              })()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {currentAQI.length === 0 ? (
            <p className="text-sm text-slate-400">No current AQI observations available.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {currentAQI.map((obs, i) => (
                <div
                  key={i}
                  className="rounded-lg p-4 text-center"
                  style={{
                    backgroundColor: getAQIColor(getCategoryName(obs)),
                    color: getAQITextColor(getCategoryName(obs)),
                  }}
                >
                  <p className="text-xs font-medium opacity-80">{obs.parameterName}</p>
                  <p className="text-3xl font-bold">{obs.aqi}</p>
                  <p className="text-xs font-medium">{getCategoryName(obs)}</p>
                </div>
              ))}
            </div>
          )}
          {currentAQI.length > 0 && (
            <p className="text-xs text-slate-500 mt-3">
              {getAQIRecommendation(getCategoryName(currentAQI[0]))}
            </p>
          )}
        </CardContent>
      </Card>

      {/* AQI Forecast */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Today&apos;s Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {todayForecast.length === 0 ? (
              <p className="text-sm text-slate-400">No forecast available.</p>
            ) : (
              <div className="space-y-2">
                {todayForecast.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded p-2"
                    style={{
                      backgroundColor: getAQIColor(getCategoryName(f)) + '20',
                      borderLeft: `3px solid ${getAQIColor(getCategoryName(f))}`,
                    }}
                  >
                    <span className="text-sm font-medium">{f.parameterName}</span>
                    <span className="text-sm">
                      AQI {f.aqi} — {getCategoryName(f)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">Tomorrow&apos;s Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {tomorrowForecast.length === 0 ? (
              <p className="text-sm text-slate-400">No forecast available.</p>
            ) : (
              <div className="space-y-2">
                {tomorrowForecast.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded p-2"
                    style={{
                      backgroundColor: getAQIColor(getCategoryName(f)) + '20',
                      borderLeft: `3px solid ${getAQIColor(getCategoryName(f))}`,
                    }}
                  >
                    <span className="text-sm font-medium">{f.parameterName}</span>
                    <span className="text-sm">
                      AQI {f.aqi} — {getCategoryName(f)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mississippi AQ Monitor Map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">
            Mississippi Air Quality Monitors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aqiMonitors.length > 0 ? (
            <>
              <MonitorMap monitors={aqiMonitors} />
              <p className="text-[11px] text-slate-400 mt-2">
                Monitor data: latest hourly readings (24-hour rolling window) — click a site for details and timestamp
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">No monitor data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
