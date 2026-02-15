'use client';

import { useDashboard } from '@/lib/dashboard-context';
import { getBurnQualityColor } from '@/lib/constants';
import { Flame, MapPin, Wind, Thermometer, Droplets, ArrowUpDown } from 'lucide-react';
import { useEffect } from 'react';

export default function PrintPlanPage() {
  const { location, forecast, currentForecastIdx, prescription, stationObservation } = useDashboard();

  useEffect(() => {
    // Optional: automatically trigger print dialog
    // window.print();
  }, []);

  if (!location || !forecast.length) {
    return (
      <div className="p-8 text-center">
        <p>No data available to print. Please search for a location first.</p>
      </div>
    );
  }

  const now = forecast[currentForecastIdx];
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-slate-900 print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Flame className="text-orange-600" /> Prescribed Fire Burn Plan
          </h1>
          <p className="text-slate-500 mt-1">Operational Weather Summary</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">{today}</p>
          <p>Generated at: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Location & Conditions Grid */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <section>
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1 flex items-center gap-2">
            <MapPin size={18} /> Location
          </h2>
          <div className="space-y-1">
            <p className="text-xl font-bold">{location.city}, {location.state}</p>
            <p className="text-sm">{location.displayName}</p>
            <p className="text-sm text-slate-500">Coords: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}</p>
          </div>
          
          <div className="mt-4 p-3 bg-slate-50 rounded border text-sm">
            <h3 className="font-bold mb-1">Nearest Station:</h3>
            {stationObservation ? (
              <p>{stationObservation.stationName} ({stationObservation.distanceMiles} mi)</p>
            ) : (
              <p>NWS Grid Point Data</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1 flex items-center gap-2">
            <Flame size={18} /> Prescription
          </h2>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="font-medium">RH Range:</div>
            <div>{prescription.humidityMin}% - {prescription.humidityMax}%</div>
            
            <div className="font-medium">Temp Range:</div>
            <div>{prescription.tempMin}°F - {prescription.tempMax}°F</div>
            
            <div className="font-medium">Wind Range:</div>
            <div>{prescription.windSpeedMin} - {prescription.windSpeedMax} mph</div>
            
            <div className="font-medium">Min VI:</div>
            <div>{prescription.minVentilationIndex.toLocaleString()}</div>

            <div className="font-medium text-orange-700">Days Since Rain (Rx):</div>
            <div className="text-orange-700 font-bold">{prescription.daysSinceRain} days</div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400 italic">
            * &apos;Days Since Rain&apos; is a manual prescription parameter used for fuel moisture models.
          </p>
        </section>
      </div>

      {/* Current Conditions Table */}
      <section className="mb-8">
        <h2 className="text-lg font-bold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1">
          Current Forecasted Conditions
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border rounded text-center">
            <Thermometer className="mx-auto mb-1 text-slate-400" size={20} />
            <p className="text-xs uppercase font-bold text-slate-500">Temp</p>
            <p className="text-2xl font-bold">{now.temp}°F</p>
          </div>
          <div className="p-4 border rounded text-center">
            <Droplets className="mx-auto mb-1 text-slate-400" size={20} />
            <p className="text-xs uppercase font-bold text-slate-500">Humidity</p>
            <p className="text-2xl font-bold">{now.humidity}%</p>
          </div>
          <div className="p-4 border rounded text-center">
            <Wind className="mx-auto mb-1 text-slate-400" size={20} />
            <p className="text-xs uppercase font-bold text-slate-500">Wind</p>
            <p className="text-2xl font-bold">{now.windDirectionCardinal} {now.windSpeed} mph</p>
          </div>
          <div className="p-4 border rounded text-center">
            <ArrowUpDown className="mx-auto mb-1 text-slate-400" size={20} />
            <p className="text-xs uppercase font-bold text-slate-500">Vent Index</p>
            <p className="text-2xl font-bold">{now.ventilationIndex.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* 12-Hour Outlook Table */}
      <section className="mb-8">
        <h2 className="text-lg font-bold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1">
          12-Hour Hourly Outlook
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border p-2 text-left">Time</th>
              <th className="border p-2 text-center">Temp</th>
              <th className="border p-2 text-center">RH</th>
              <th className="border p-2 text-center">Wind</th>
              <th className="border p-2 text-center">Dispersion</th>
              <th className="border p-2 text-center">Burn Quality</th>
            </tr>
          </thead>
          <tbody>
            {forecast.slice(currentForecastIdx, currentForecastIdx + 12).map((h, i) => (
              <tr key={i}>
                <td className="border p-2 font-medium">
                  {new Date(h.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </td>
                <td className="border p-2 text-center">{h.temp}°F</td>
                <td className="border p-2 text-center">{h.humidity}%</td>
                <td className="border p-2 text-center">{h.windDirectionCardinal} {h.windSpeed} mph</td>
                <td className="border p-2 text-center text-xs">{h.dispersionCategory}</td>
                <td className="border p-2 text-center font-bold" style={{ color: getBurnQualityColor(h.burnScore) }}>
                  {h.burnQuality}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Smoke Management */}
      <section className="mb-8">
        <h2 className="text-lg font-bold uppercase tracking-wider text-slate-700 mb-3 border-b pb-1">
          Smoke Management & Fire Behavior
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 border rounded">
            <p className="font-bold mb-1">Smoke Dispersion:</p>
            <p>{now.dispersionDescription}</p>
            <p className="mt-2 text-xs">Mixing Height: {now.mixingHeight.toLocaleString()} ft</p>
            <p className="text-xs">Transport Wind: {now.transportWindDirectionCardinal} {now.transportWindSpeed} mph</p>
          </div>
          <div className="p-3 border rounded">
            <p className="font-bold mb-1">Fire Indices:</p>
            <p>Probability of Ignition: {now.ignitionProbability}%</p>
            <p>1-Hour Fuel Moisture: {now.fuelMoisture1hr}%</p>
            <p>10-Hour Fuel Moisture: {now.fuelMoisture10hr}%</p>
            <p>Haines Index: {now.hainesIndex}</p>
          </div>
        </div>
      </section>

      {/* Footer / Notes */}
      <div className="border-t pt-4 mt-8">
        <div className="flex justify-between items-end">
          <div className="flex-1">
            <h3 className="font-bold text-xs uppercase text-slate-400 mb-2">Notes / Observations</h3>
            <div className="h-24 border-2 border-dashed border-slate-200 rounded"></div>
          </div>
          <div className="ml-8 text-right text-[10px] text-slate-400">
            <p>Source: Prescribed Fire Weather Dashboard v3.0</p>
            <p>Data: NWS, AirNow, NOAA HMS</p>
          </div>
        </div>
      </div>

      {/* Print Button - hidden during actual print */}
      <div className="mt-8 flex justify-center print:hidden">
        <button 
          onClick={() => window.print()}
          className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors"
        >
          Print Burn Plan
        </button>
      </div>
    </div>
  );
}
