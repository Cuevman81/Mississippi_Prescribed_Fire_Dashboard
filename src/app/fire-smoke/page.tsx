'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Flame } from 'lucide-react';
import type { HMSData } from '@/lib/types';
import { HMS_REGIONS, DEFAULT_HMS_REGION } from '@/lib/constants';
import dynamic from 'next/dynamic';

const HMSMap = dynamic(() => import('@/components/maps/HMSFireSmokeMap'), { ssr: false });

export default function FireSmokePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [region, setRegion] = useState(DEFAULT_HMS_REGION);
  const [hmsData, setHmsData] = useState<HMSData | null>(null);
  const [loading, setLoading] = useState(false);

  const regionConfig = HMS_REGIONS[region] || HMS_REGIONS[DEFAULT_HMS_REGION];

  useEffect(() => {
    async function fetchHMS() {
      setLoading(true);
      try {
        const res = await fetch(`/api/hms?date=${date}&region=${region}`);
        if (res.ok) {
          const data = await res.json();
          setHmsData(data);
        }
      } catch {
        // HMS data not available
      }
      setLoading(false);
    }
    fetchHMS();
  }, [date, region]);

  const shownFires = hmsData?.fires.length || 0;
  const totalFires = hmsData?.totalFires ?? shownFires;
  const isCapped = totalFires > shownFires;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            NOAA Hazard Mapping System — Fire Detections & Smoke
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="hms-region" className="text-xs text-slate-500">Region:</Label>
              <select
                id="hms-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Object.entries(HMS_REGIONS).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Date:</Label>
              <Input
                type="date"
                value={date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                className="w-40 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hmsData ? (
            // Keep the map mounted while a new date/region loads — remounting
            // Leaflet on every change is expensive; overlay a spinner instead
            <div className="relative">
              <HMSMap data={hmsData} center={regionConfig.center} zoom={regionConfig.zoom} />
              {loading && (
                <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/60 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-3 text-xs text-slate-500">
                <span>
                  <span className="inline-block w-3 h-3 rounded-full bg-red-600 mr-1" />
                  Fire detections: {shownFires.toLocaleString()}
                  {isCapped && ` of ${totalFires.toLocaleString()} (showing most intense)`}
                </span>
                <span>
                  <span className="inline-block w-3 h-3 rounded bg-gray-400 mr-1" />
                  Smoke polygons: {hmsData.smoke?.features?.length || 0}
                </span>
                <span className="text-slate-400">
                  Showing {regionConfig.label}
                </span>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 text-slate-400">
              <p>No HMS data available for this date.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-slate-400 p-2">
        Data from NOAA Hazard Mapping System. Fire detections are satellite-based
        (GOES, VIIRS, MODIS) and may include both wildfires and prescribed burns.
        Circle size represents Fire Radiative Power (FRP).
        Smoke polygons are analyst-drawn from satellite imagery and are shown
        when they extend into the selected region, even from distant fires.
      </div>
    </div>
  );
}
