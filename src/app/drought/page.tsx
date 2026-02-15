'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Droplets } from 'lucide-react';
import { DROUGHT_COLORS } from '@/lib/constants';
import dynamic from 'next/dynamic';

const DroughtMap = dynamic(() => import('@/components/maps/DroughtMap'), { ssr: false });

export default function DroughtPage() {
  const [droughtData, setDroughtData] = useState<(GeoJSON.FeatureCollection & { lastUpdated?: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDrought() {
      try {
        const res = await fetch('/api/drought');
        if (res.ok) {
          const data = await res.json();
          setDroughtData(data);
        }
      } catch {
        // Drought data unavailable
      }
      setLoading(false);
    }
    fetchDrought();
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            U.S. Drought Monitor
          </CardTitle>
          {droughtData?.lastUpdated && (
            <p className="text-[10px] text-slate-400">
              Last updated: {new Date(droughtData.lastUpdated).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : droughtData ? (
            <DroughtMap data={droughtData} />
          ) : (
            <div className="flex items-center justify-center h-96 text-slate-400">
              <p>Drought data unavailable.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">Drought Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(DROUGHT_COLORS).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded border"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-slate-600">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Data from the U.S. Drought Monitor (droughtmonitor.unl.edu).
            Updated weekly on Thursdays. Drought conditions affect fire risk,
            fuel moisture, and prescribed burn planning.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
