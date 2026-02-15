'use client';

import { useState } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { useDashboard } from '@/lib/dashboard-context';
import { MobileSidebar } from './MobileSidebar';
import { PRESCRIPTION_PRESETS } from '@/lib/constants';

export function Header() {
  const { isLoading, fetchForecast, location, prescription, setPrescription } = useDashboard();
  const [query, setQuery] = useState('Jackson, MS');
  const [showParams, setShowParams] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchForecast(query.trim());
    }
  };

  return (
    <header className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
      {/* Mobile menu button */}
      <div className="lg:hidden">
        <MobileSidebar />
      </div>

      {/* Location search */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1 max-w-xl">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter location (e.g., Jackson, MS)"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={isLoading} className="bg-orange-600 hover:bg-orange-700">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Get Forecast</span>
        </Button>
      </form>

      {/* Location display */}
      {location && (
        <div className="hidden md:block text-sm text-slate-500">
          {location.city}, {location.stateAbbr} ({location.lat.toFixed(4)}, {location.lon.toFixed(4)})
        </div>
      )}

      {/* Prescription parameters toggle */}
      <Sheet open={showParams} onOpenChange={setShowParams}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="hidden sm:flex">
            Rx Parameters
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Prescription Parameters</SheetTitle>
            <SheetDescription>
              Set your burn prescription thresholds. These are used to identify optimal burn windows.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-400">Quick Presets</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PRESCRIPTION_PRESETS).map(([name, params]) => (
                  <Button
                    key={name}
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-auto py-2 px-1 justify-start text-left block overflow-hidden text-ellipsis whitespace-nowrap"
                    onClick={() => setPrescription(params)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium">
                  Relative Humidity: {prescription.humidityMin}% - {prescription.humidityMax}%
                </Label>
                <Slider
                  value={[prescription.humidityMin, prescription.humidityMax]}
                  onValueChange={([min, max]) =>
                    setPrescription({ ...prescription, humidityMin: min, humidityMax: max })
                  }
                  min={0}
                  max={100}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Wind Speed: {prescription.windSpeedMin} - {prescription.windSpeedMax} mph
                </Label>
                <Slider
                  value={[prescription.windSpeedMin, prescription.windSpeedMax]}
                  onValueChange={([min, max]) =>
                    setPrescription({ ...prescription, windSpeedMin: min, windSpeedMax: max })
                  }
                  min={0}
                  max={30}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Temperature: {prescription.tempMin} - {prescription.tempMax} °F
                </Label>
                <Slider
                  value={[prescription.tempMin, prescription.tempMax]}
                  onValueChange={([min, max]) =>
                    setPrescription({ ...prescription, tempMin: min, tempMax: max })
                  }
                  min={0}
                  max={110}
                  step={1}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Min Ventilation Index: {prescription.minVentilationIndex.toLocaleString()}
                </Label>
                <Slider
                  value={[prescription.minVentilationIndex]}
                  onValueChange={([val]) =>
                    setPrescription({ ...prescription, minVentilationIndex: val })
                  }
                  min={0}
                  max={100000}
                  step={5000}
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Days Since Rain: {prescription.daysSinceRain}
                </Label>
                <Slider
                  value={[prescription.daysSinceRain]}
                  onValueChange={([val]) =>
                    setPrescription({ ...prescription, daysSinceRain: val })
                  }
                  min={0}
                  max={90}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
