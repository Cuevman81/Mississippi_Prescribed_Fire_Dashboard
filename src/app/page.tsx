'use client';

import { useDashboard } from '@/lib/dashboard-context';
import { CurrentConditions } from '@/components/dashboard/CurrentConditions';
import { BurnStatusSummary } from '@/components/dashboard/BurnStatusSummary';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { SmokeDispersion } from '@/components/dashboard/SmokeDispersion';
import { FireIndices } from '@/components/dashboard/FireIndices';
import { BurnQualityChart } from '@/components/dashboard/BurnQualityChart';
import { WeatherTrendChart } from '@/components/dashboard/WeatherTrendChart';
import { Flame, Loader2, Map as MapIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

const LocationMap = dynamic(() => import('@/components/maps/LocationMap'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-lg" />
});

export default function DashboardPage() {
  const { forecast, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto mb-3" />
          <p className="text-slate-500">Loading forecast data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium mb-2">Error</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!forecast.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <Flame className="h-12 w-12 text-orange-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">
            Prescribed Fire Weather Dashboard
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Enter a location and click &quot;Get Forecast&quot; to view current conditions,
            fire weather indices, burn quality, and more.
          </p>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Data sources: NWS, AirNow (EPA), NOAA HMS, MFC</p>
            <p>Mississippi Department of Environmental Quality</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AlertBanner />
      <CurrentConditions />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <BurnStatusSummary />
        </div>
        <div className="xl:col-span-1">
          <LocationMap />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SmokeDispersion />
        <FireIndices />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BurnQualityChart />
        <WeatherTrendChart />
      </div>
    </div>
  );
}
