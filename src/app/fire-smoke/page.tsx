'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Flame } from 'lucide-react';
import type { HMSData } from '@/lib/types';
import dynamic from 'next/dynamic';

const HMSMap = dynamic(() => import('@/components/maps/HMSFireSmokeMap'), { ssr: false });

export default function FireSmokePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hmsData, setHmsData] = useState<HMSData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchHMS() {
      setLoading(true);
      try {
        const res = await fetch(`/api/hms?date=${date}`);
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
  }, [date]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" />
            NOAA Hazard Mapping System — Fire Detections & Smoke
          </CardTitle>
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
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : hmsData ? (
            <>
              <HMSMap data={hmsData} />
              <div className="flex items-center gap-6 mt-3 text-xs text-slate-500">
                <span>
                  <span className="inline-block w-3 h-3 rounded-full bg-red-600 mr-1" />
                  Fire detections: {hmsData.fires.length}
                </span>
                <span>
                  <span className="inline-block w-3 h-3 rounded bg-gray-400 mr-1" />
                  Smoke polygons: {hmsData.smoke?.features?.length || 0}
                </span>
              </div>
            </>
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
        Smoke polygons are analyst-drawn from satellite imagery.
      </div>
    </div>
  );
}
