'use client';

import { useDashboard } from '@/lib/dashboard-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function BurnWindowFinder() {
    const { forecast, currentForecastIdx, prescription } = useDashboard();

    if (!forecast.length) return null;

    // Find contiguous blocks of hours that meet prescription
    const windows: any[] = [];
    let currentWindow: any = null;

    const startIndex = currentForecastIdx;
    const outlookHours = 72; // Analyze next 72 hours

    for (let i = startIndex; i < Math.min(forecast.length, startIndex + outlookHours); i++) {
        const f = forecast[i];

        // Check if hour is strictly within prescription
        const isGood =
            f.temp >= prescription.tempMin &&
            f.temp <= prescription.tempMax &&
            f.humidity >= prescription.humidityMin &&
            f.humidity <= prescription.humidityMax &&
            f.windSpeed >= prescription.windSpeedMin &&
            f.windSpeed <= prescription.windSpeedMax &&
            f.ventilationIndex >= prescription.minVentilationIndex;

        if (isGood) {
            if (!currentWindow) {
                currentWindow = {
                    startIndex: i,
                    startTime: new Date(f.time),
                    endTime: new Date(f.time),
                    hours: 1,
                    temps: [f.temp],
                    rhs: [f.humidity],
                    winds: [f.windSpeed],
                    vis: [f.ventilationIndex]
                };
            } else {
                currentWindow.hours++;
                currentWindow.endTime = new Date(f.time);
                currentWindow.temps.push(f.temp);
                currentWindow.rhs.push(f.humidity);
                currentWindow.winds.push(f.windSpeed);
                currentWindow.vis.push(f.ventilationIndex);
            }
        } else {
            if (currentWindow) {
                // Only keep windows longer than 2 hours
                if (currentWindow.hours >= 2) {
                    windows.push(currentWindow);
                }
                currentWindow = null;
            }
        }
    }

    // Handle a window that runs to the end of the forecast array
    if (currentWindow && currentWindow.hours >= 2) {
        windows.push(currentWindow);
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Card className="bg-white/70 backdrop-blur-md border border-white/40 shadow-xl shadow-slate-200/50">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Burn Window Outlook (Next 72 Hours)
                    </CardTitle>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {windows.length} Windows Found
                    </span>
                </CardHeader>
                <CardContent>
                    {windows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <AlertCircle className="w-8 h-8 text-amber-500/50 mb-2" />
                            <p className="text-sm font-medium text-slate-600">No contiguous burn windows found.</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[250px]">
                                Consider adjusting your Custom Rx thresholds or check the Burn Quality chart for marginal opportunities.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {windows.slice(0, 3).map((w, idx) => {
                                const startStr = w.startTime.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                                const endStr = new Date(w.endTime.getTime() + 3600000).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
                                const dayStr = w.startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                                const avgTemp = Math.round(w.temps.reduce((a: number, b: number) => a + b, 0) / w.hours);
                                const avgRH = Math.round(w.rhs.reduce((a: number, b: number) => a + b, 0) / w.hours);
                                const avgWind = Math.round((w.winds.reduce((a: number, b: number) => a + b, 0) / w.hours) * 10) / 10;

                                return (
                                    <div key={idx} className="bg-white border border-green-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded w-fit mb-2">
                                                    <Calendar className="w-3 h-3" />
                                                    {dayStr}
                                                </div>
                                                <h4 className="font-bold text-slate-800">{startStr} - {endStr}</h4>
                                            </div>
                                            <span className="bg-green-100 text-green-800 text-xs font-extrabold px-2.5 py-1 rounded-full">
                                                {w.hours} hrs
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center mt-3 pt-3 border-t border-slate-100">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Avg Temp</p>
                                                <p className="font-bold text-slate-700">{avgTemp}°</p>
                                            </div>
                                            <div className="border-l border-r border-slate-100">
                                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Avg RH</p>
                                                <p className="font-bold text-slate-700">{avgRH}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-semibold uppercase">Avg Wind</p>
                                                <p className="font-bold text-slate-700">{avgWind}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
