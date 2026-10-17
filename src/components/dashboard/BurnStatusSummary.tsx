'use client';

import { CheckCircle2, XCircle, Info, Ban, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboard } from '@/lib/dashboard-context';
import { CRITICAL_FIRE_ALERTS } from '@/lib/constants';
import { EXEMPTION_LABELS, formatBanTime } from '@/lib/burn-bans';
import { motion } from 'framer-motion';

export function BurnStatusSummary() {
  const { forecast, currentForecastIdx, prescription, alerts, alertsAvailable, burnBans, burnBanStatus } = useDashboard();
  const nowForecast = forecast[currentForecastIdx] || forecast[0];

  if (!nowForecast) return null;

  const reasons: string[] = [];

  // Check for critical fire weather alerts
  const criticalAlerts = alerts.filter(a =>
    (CRITICAL_FIRE_ALERTS as readonly string[]).includes(a.event)
  );

  if (criticalAlerts.length > 0) {
    reasons.push(`NWS ${criticalAlerts[0].event} ACTIVE`);
  }

  // Fail closed: if the alert check itself failed, never show green
  if (!alertsAvailable) {
    reasons.push('NWS alerts could not be checked — verify at weather.gov');
  }

  // County burn ban: a veto only when the order doesn't exempt certified burn
  // managers (or it's an MFC ban). An exempting order is shown as a warning below.
  const banVeto = burnBanStatus.effect === 'restricted';
  if (banVeto) reasons.push(burnBanStatus.message);
  if (burnBanStatus.effect === 'unknown') {
    reasons.push(burnBans === null ? 'Checking county burn bans…' : burnBanStatus.message);
  }

  if (nowForecast.temp < prescription.tempMin) reasons.push(`Temp too low (${nowForecast.temp}°F < ${prescription.tempMin}°F)`);
  if (nowForecast.temp > prescription.tempMax) reasons.push(`Temp too high (${nowForecast.temp}°F > ${prescription.tempMax}°F)`);
  if (nowForecast.humidity < prescription.humidityMin) reasons.push(`RH too low (${nowForecast.humidity}% < ${prescription.humidityMin}%)`);
  if (nowForecast.humidity > prescription.humidityMax) reasons.push(`RH too high (${nowForecast.humidity}% > ${prescription.humidityMax}%)`);
  if (nowForecast.windSpeed < prescription.windSpeedMin) reasons.push(`Wind too low (${nowForecast.windSpeed} mph < ${prescription.windSpeedMin} mph)`);
  if (nowForecast.windSpeed > prescription.windSpeedMax) reasons.push(`Wind too high (${nowForecast.windSpeed} mph > ${prescription.windSpeedMax} mph)`);
  if (nowForecast.ventilationIndex < prescription.minVentilationIndex) reasons.push(`VI too low (${nowForecast.ventilationIndex.toLocaleString()} < ${prescription.minVentilationIndex.toLocaleString()})`);

  const hasNwsVeto = criticalAlerts.length > 0;
  const hasCriticalAlert = hasNwsVeto || banVeto;
  const banNotice = burnBanStatus.ban && (burnBanStatus.effect === 'restricted' || burnBanStatus.effect === 'warning');
  const isInPrescription = reasons.length === 0;

  let borderColor = 'border-l-green-500';
  let bgColor = 'bg-green-50/50';
  let textColor = 'text-green-800';

  if (hasCriticalAlert) {
    borderColor = 'border-l-red-600';
    bgColor = 'bg-red-50/80';
    textColor = 'text-red-900';
  } else if (!isInPrescription) {
    borderColor = 'border-l-amber-500';
    bgColor = 'bg-amber-50/50';
    textColor = 'text-amber-800';
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className={`border-l-8 shadow-lg ${borderColor} ${bgColor} backdrop-blur-md`}>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {isInPrescription ? (
              <CheckCircle2 className={`h-8 w-8 text-green-600 mt-0.5`} />
            ) : (
              <XCircle className={`h-8 w-8 ${hasCriticalAlert ? 'text-red-600' : 'text-amber-600'} mt-0.5`} />
            )}
            <div>
              <h3 className={`font-extrabold text-xl ${textColor}`}>
                {hasCriticalAlert ? 'BURN VETOED / RESTRICTED' : isInPrescription ? 'Within Prescription' : 'Outside Prescription'}
              </h3>
              <p className="text-sm font-medium text-slate-700 mt-1">
                {hasNwsVeto
                  ? 'NWS critical fire weather alert is active. Burning is not recommended.'
                  : banVeto
                  ? `${burnBanStatus.county} County is under a burn ban that does not exempt certified burn managers. Burning is prohibited.`
                  : isInPrescription
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
          </div>

          {banNotice && burnBanStatus.ban && burnBans?.available && (
            <div
              role="alert"
              className={`rounded-lg border-2 p-3 text-sm ${
                burnBanStatus.effect === 'restricted'
                  ? 'border-red-700 bg-red-600 text-white'
                  : 'border-orange-600 bg-orange-50 text-orange-950'
              }`}
            >
              <p className="flex items-center gap-2 font-black uppercase tracking-tight">
                <Ban className="h-5 w-5 flex-shrink-0" />
                Burn ban in effect: {burnBanStatus.county} County
              </p>
              <p className="mt-1 font-semibold">
                {burnBanStatus.ban.mfcBan
                  ? 'Mississippi Forestry Commission ban: no outdoor burning of any kind, regardless of exemptions.'
                  : burnBanStatus.ban.exemptions === null
                    ? 'Exemption status unknown: MFC\'s exemption data could not be read. Confirm with MFC or the county whether certified burn managers are exempt before ignition.'
                    : burnBanStatus.effect === 'warning'
                      ? 'This county\'s order exempts Certified Burn Managers. A certified prescribed burn manager may burn under an MFC burn permit; all other outdoor burning is prohibited.'
                      : 'This county\'s order does not exempt Certified Burn Managers. Prescribed burning is prohibited until the ban ends.'}
              </p>
              {burnBanStatus.ban.exemptions && !burnBanStatus.ban.mfcBan && (
                <p className="mt-1 text-xs">
                  Exemptions on this order:{' '}
                  {burnBanStatus.ban.exemptions.length
                    ? burnBanStatus.ban.exemptions.map((n) => `${n} ${EXEMPTION_LABELS[n]}`).join(' · ')
                    : 'none'}
                </p>
              )}
              <p className="mt-1 text-xs opacity-90">
                Miss. Code § 49-19-351 · MFC data as of {formatBanTime(burnBans.asOf)} ·{' '}
                <a href={burnBans.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                  mfc.ms.gov <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
