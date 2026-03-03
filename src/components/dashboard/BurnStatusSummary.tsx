'use client';

import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';
import { motion } from 'framer-motion';

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
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className={`border-l-8 shadow-lg ${isInPrescription ? 'border-l-green-500 bg-green-50/50 backdrop-blur-md' : 'border-l-amber-500 bg-amber-50/50 backdrop-blur-md'}`}>
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {isInPrescription ? (
              <CheckCircle2 className="h-8 w-8 text-green-600 mt-0.5" />
            ) : (
              <XCircle className="h-8 w-8 text-amber-600 mt-0.5" />
            )}
            <div>
              <h3 className={`font-extrabold text-xl ${isInPrescription ? 'text-green-800' : 'text-amber-800'}`}>
                {isInPrescription ? 'Within Prescription' : 'Outside Prescription'}
              </h3>
              <p className="text-sm font-medium text-slate-700 mt-1">
                {isInPrescription
                  ? 'Current conditions meet all your set criteria for a prescribed burn.'
                  : 'Current conditions do not meet one or more of your prescription thresholds.'}
              </p>
            </div>
          </div>

          {!isInPrescription && reasons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {reasons.map((reason, i) => (
                <span key={i} className="px-3 py-1 bg-amber-100/80 text-amber-900 text-xs font-bold rounded-full border border-amber-300 shadow-sm">
                  {reason}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs font-bold text-slate-600 bg-white/70 shadow-sm p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-800">
              <Info className="h-4 w-4" />
              <span>Active Rx:</span>
            </div>
            <span className="bg-slate-100 px-2 py-1 rounded">RH: {prescription.humidityMin}-{prescription.humidityMax}%</span>
            <span className="bg-slate-100 px-2 py-1 rounded">Wind: {prescription.windSpeedMin}-{prescription.windSpeedMax}mph</span>
            <span className="bg-slate-100 px-2 py-1 rounded">Temp: {prescription.tempMin}-{prescription.tempMax}°F</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
