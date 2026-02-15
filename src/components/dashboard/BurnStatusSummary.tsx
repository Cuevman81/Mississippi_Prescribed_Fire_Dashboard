'use client';

import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';

export function BurnStatusSummary() {
  const { forecast, currentForecastIdx, prescription } = useDashboard();
  
  const nowForecast = forecast[currentForecastIdx] || forecast[0];
  
  if (!nowForecast) return null;

  const reasons: string[] = [];
  
  if (nowForecast.temp < prescription.tempMin) reasons.push(`Temp too low (${nowForecast.temp}°F < ${prescription.tempMin}°F)`);
  if (nowForecast.temp > prescription.tempMax) reasons.push(`Temp too high (${nowForecast.temp}°F > ${prescription.tempMax}°F)`);
  if (nowForecast.humidity < prescription.humidityMin) reasons.push(`RH too low (${nowForecast.humidity}% < ${prescription.humidityMin}%)`);
  if (nowForecast.humidity > prescription.humidityMax) reasons.push(`RH too high (${nowForecast.humidity}% > ${prescription.humidityMax}%)`);
  if (nowForecast.windSpeed < prescription.windSpeedMin) reasons.push(`Wind too low (${nowForecast.windSpeed} mph < ${prescription.windSpeedMin} mph)`);
  if (nowForecast.windSpeed > prescription.windSpeedMax) reasons.push(`Wind too high (${nowForecast.windSpeed} mph > ${prescription.windSpeedMax} mph)`);
  if (nowForecast.ventilationIndex < prescription.minVentilationIndex) reasons.push(`VI too low (${nowForecast.ventilationIndex.toLocaleString()} < ${prescription.minVentilationIndex.toLocaleString()})`);

  const isInPrescription = reasons.length === 0;

  return (
    <Card className={`border-l-4 ${isInPrescription ? 'border-l-green-500 bg-green-50/30' : 'border-l-amber-500 bg-amber-50/30'}`}>
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {isInPrescription ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5" />
          ) : (
            <XCircle className="h-6 w-6 text-amber-600 mt-0.5" />
          )}
          <div>
            <h3 className={`font-bold text-lg ${isInPrescription ? 'text-green-800' : 'text-amber-800'}`}>
              {isInPrescription ? 'Within Prescription' : 'Outside Prescription'}
            </h3>
            <p className="text-sm text-slate-600">
              {isInPrescription 
                ? 'Current conditions meet all your set criteria for a prescribed burn.' 
                : 'Current conditions do not meet one or more of your prescription thresholds.'}
            </p>
          </div>
        </div>

        {!isInPrescription && reasons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {reasons.map((reason, i) => (
              <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full border border-amber-200">
                {reason}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 bg-white/50 p-2 rounded-lg border border-slate-100">
           <div className="flex items-center gap-1">
             <Info className="h-3 w-3" />
             <span>Active Rx:</span>
           </div>
           <span>RH: {prescription.humidityMin}-{prescription.humidityMax}%</span>
           <span>Wind: {prescription.windSpeedMin}-{prescription.windSpeedMax}mph</span>
           <span>Temp: {prescription.tempMin}-{prescription.tempMax}°F</span>
        </div>
      </CardContent>
    </Card>
  );
}
