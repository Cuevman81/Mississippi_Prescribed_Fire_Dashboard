'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, MapPin, AlertTriangle, Radio } from 'lucide-react';
import type { MFCPermit } from '@/lib/types';
import { formatNumber } from '@/lib/weather-utils';
import { getTodayStr } from '@/lib/utils';
import { PERMIT_DISPERSION_COLORS } from '@/lib/constants';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, Cell, ZAxis, Customized, LabelList,
} from 'recharts';
import dynamic from 'next/dynamic';

const PermitMaps = dynamic(() => import('@/components/maps/PermitMaps'), { ssr: false });

type DateRange = 'today' | 'week' | 'month' | '6months';

interface CountyWeather {
  windSpeed: number;
  windGust: number;
  windDirection: number;
  windDirectionCardinal: string;
  mixingHeight: number;
  transportWindSpeed: number;
  ventilationIndex: number;
  dispersionQuality: string;
  source: string;
}

export default function PermitsPage() {
  const [permits, setPermits] = useState<MFCPermit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [liveWeather, setLiveWeather] = useState<Record<string, CountyWeather>>({});
  const [weatherLoading, setWeatherLoading] = useState(false);
  const weatherFetchedRef = useRef<string>('');

  // Fetch permits
  useEffect(() => {
    async function fetchPermits() {
      try {
        const res = await fetch('/api/permits');
        if (res.ok) {
          const data = await res.json();
          setPermits(data);
        }
      } catch {
        // Permits unavailable
      }
      setLoading(false);
    }
    fetchPermits();
  }, []);

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const todayStr = getTodayStr();

  // Date range filtering
  const filteredPermits = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    switch (dateRange) {
      case 'today':
        return permits.filter((p) => p.permitDate === todayStr);
      case 'week': {
        cutoff = new Date(now.getTime() - 7 * 86400000);
        break;
      }
      case 'month': {
        cutoff = new Date(now.getTime() - 30 * 86400000);
        break;
      }
      case '6months': {
        cutoff = new Date(now.getTime() - 180 * 86400000);
        break;
      }
    }

    const cutoffStr = cutoff!.toISOString().split('T')[0];
    return permits.filter((p) => p.permitDate >= cutoffStr);
  }, [permits, dateRange, todayStr]);

  const todayPermits = useMemo(
    () => permits.filter((p) => p.permitDate === todayStr),
    [permits, todayStr]
  );

  // Fetch live NWS weather for today's permits
  const fetchLiveWeather = useCallback(async (todayP: MFCPermit[]) => {
    if (todayP.length === 0) return;

    // Group by county, use centroid lat/lon
    const countyMap = new Map<string, { lat: number; lon: number; count: number }>();
    for (const p of todayP) {
      if (!countyMap.has(p.county)) {
        countyMap.set(p.county, { lat: 0, lon: 0, count: 0 });
      }
      const c = countyMap.get(p.county)!;
      c.lat += p.latitude;
      c.lon += p.longitude;
      c.count += 1;
    }

    const counties = [...countyMap.entries()].map(([county, { lat, lon, count }]) => ({
      county,
      lat: lat / count,
      lon: lon / count,
    }));

    setWeatherLoading(true);
    try {
      const res = await fetch('/api/permits/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counties }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiveWeather(data);
      }
    } catch {
      // Weather enrichment failed — use MFC data
    }
    setWeatherLoading(false);
  }, []);

  useEffect(() => {
    const permitsHash = todayPermits.map(p => p.objectId).join(',');
    if (todayPermits.length > 0 && weatherFetchedRef.current !== permitsHash) {
      weatherFetchedRef.current = permitsHash;
      // Defer to avoid cascading render warning
      requestAnimationFrame(() => {
        fetchLiveWeather(todayPermits);
      });
    }
  }, [todayPermits, fetchLiveWeather]);

  // Enrich today's permits with live weather
  const enrichedTodayPermits = useMemo(() => {
    if (Object.keys(liveWeather).length === 0) return todayPermits;

    return todayPermits.map((p) => {
      const live = liveWeather[p.county];
      if (!live) return p;

      const vi = live.ventilationIndex;
      let dispersionQuality: string;
      if (vi < 20000) dispersionQuality = 'Poor (Trapping)';
      else if (vi < 40000) dispersionQuality = 'Fair';
      else dispersionQuality = 'Good (Clearing)';

      return {
        ...p,
        windSpeed: live.windSpeed,
        windDirection: live.windDirectionCardinal,
        mixingHeight: live.mixingHeight,
        ventilationIndex: live.ventilationIndex,
        dispersionQuality,
        windDeg: live.windDirection,
      };
    });
  }, [todayPermits, liveWeather]);

  // Stats
  const stats = useMemo(() => {
    const ep = enrichedTodayPermits;
    const todayCount = ep.length;
    const todayAcres = ep.reduce((s, p) => s + (p.burnAcresEstimate || 0), 0);
    const avgVI = ep.length > 0
      ? ep.reduce((s, p) => s + p.ventilationIndex, 0) / ep.length
      : 0;

    const currentYearTotal = permits.filter(p => p.year === currentYear).length;
    const currentYearAcres = permits.filter(p => p.year === currentYear).reduce((s, p) => s + (p.burnAcresEstimate || 0), 0);
    
    const prevYearTotal = permits.filter(p => p.year === prevYear).length;
    const prevYearAcres = permits.filter(p => p.year === prevYear).reduce((s, p) => s + (p.burnAcresEstimate || 0), 0);

    const todayCounties = new Set(ep.map(p => p.county)).size;

    return {
      total: permits.length,
      totalAcres: permits.reduce((s, p) => s + (p.burnAcresEstimate || 0), 0),
      todayCount,
      todayAcres,
      avgVI,
      todayCounties,
      currentYearTotal,
      currentYearAcres,
      prevYearTotal,
      prevYearAcres
    };
  }, [permits, enrichedTodayPermits, currentYear, prevYear]);

  // Top 10 counties
  const topCounties = useMemo(() => {
    const countyMap = new Map<string, Record<number, number>>();
    for (const p of permits) {
      if (!countyMap.has(p.county)) countyMap.set(p.county, {});
      const yr = countyMap.get(p.county)!;
      yr[p.year] = (yr[p.year] || 0) + (p.burnAcresEstimate || 0);
    }
    return [...countyMap.entries()]
      .map(([county, years]) => ({
        county,
        [prevYear]: Math.round(years[prevYear] || 0),
        [currentYear]: Math.round(years[currentYear] || 0),
        total: (years[prevYear] || 0) + (years[currentYear] || 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [permits, currentYear, prevYear]);

  // Smoke risk scatter data — aggregated per county to avoid overlap
  // (all permits in a county share the same county-level met data)
  const smokeRiskData = useMemo(() => {
    const countyMap = new Map<string, {
      windSpeed: number; mixingHeight: number; acres: number;
      count: number; vi: number; quality: string; county: string;
    }>();
    for (const p of enrichedTodayPermits) {
      if (!p.windSpeed || !p.mixingHeight) continue;
      if (!countyMap.has(p.county)) {
        countyMap.set(p.county, {
          windSpeed: p.windSpeed,
          mixingHeight: p.mixingHeight,
          acres: 0,
          count: 0,
          vi: p.ventilationIndex,
          quality: p.dispersionQuality,
          county: p.county,
        });
      }
      const entry = countyMap.get(p.county)!;
      entry.acres += p.burnAcresEstimate || 0;
      entry.count += 1;
    }
    return [...countyMap.values()];
  }, [enrichedTodayPermits]);

  // Daily permit profile data — grouped by burn type/purpose & manager certification
  const permitProfileData = useMemo(() => {
    const groups = new Map<string, { Yes: number; No: number; Unknown: number; total: number }>();
    for (const p of enrichedTodayPermits) {
      const typePart = p.burnType || '';
      const purposePart = p.burnPurpose || '';
      const label = typePart && purposePart
        ? `${typePart} (${purposePart})`
        : typePart || purposePart || 'Unspecified';
      if (!groups.has(label)) {
        groups.set(label, { Yes: 0, No: 0, Unknown: 0, total: 0 });
      }
      const g = groups.get(label)!;
      const mgr = (p.certBurnManager || '').trim();
      if (mgr === 'Yes') g.Yes++;
      else if (mgr === 'No') g.No++;
      else g.Unknown++;
      g.total++;
    }
    return [...groups.entries()]
      .map(([label, counts]) => ({ label, ...counts }))
      .sort((a, b) => a.total - b.total); // ascending so top bar = highest
  }, [enrichedTodayPermits]);

  // simplified risk zone renderer for Recharts Customized component
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RiskZoneBackground = (props: any) => {
    const { width, height, margin } = props;
    if (!width || !height) return null;

    const xLeft = margin.left;
    const xRight = width - margin.right;
    const yTop = margin.top;
    const yBottom = height - margin.bottom;
    const plotWidth = xRight - xLeft;
    const plotHeight = yBottom - yTop;

    return (
      <g>
        {/* Good zone background (top right) */}
        <rect x={xLeft} y={yTop} width={plotWidth} height={plotHeight} fill="#99FF99" fillOpacity={0.15} />
        {/* Fair zone (middle) */}
        <path 
          d={`M ${xLeft},${yBottom} L ${xRight},${yBottom} L ${xRight},${yTop + plotHeight * 0.4} L ${xLeft},${yBottom - plotHeight * 0.4} Z`} 
          fill="#FFFF99" fillOpacity={0.3} 
        />
        {/* Poor zone (bottom left) */}
        <path 
          d={`M ${xLeft},${yBottom} L ${xRight},${yBottom} L ${xRight},${yBottom - plotHeight * 0.2} L ${xLeft},${yBottom - plotHeight * 0.1} Z`} 
          fill="#FF9999" fillOpacity={0.3} 
        />
        
        {/* Labels */}
        <text x={xRight - 40} y={yBottom - 20} fontSize={10} fill="#CC3333" fontWeight="bold" textAnchor="end">Poor</text>
        <text x={xRight - 40} y={yTop + plotHeight/2} fontSize={10} fill="#999933" fontWeight="bold" textAnchor="end">Fair</text>
        <text x={xLeft + 40} y={yTop + 20} fontSize={10} fill="#339933" fontWeight="bold">Good</text>
      </g>
    );
  };

  // For the table: show permits based on date range, with enriched data for today
  const tablePermits = useMemo(() => {
    if (dateRange === 'today') return enrichedTodayPermits;
    return filteredPermits;
  }, [dateRange, enrichedTodayPermits, filteredPermits]);

  // For maps: always use enriched today permits
  const mapPermits = enrichedTodayPermits;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { 
            label: 'Total Permits', 
            value: formatNumber(stats.total), 
            icon: FileText,
            breakdown: `${currentYear}: ${formatNumber(stats.currentYearTotal)} | ${prevYear}: ${formatNumber(stats.prevYearTotal)}`
          },
          { 
            label: 'Total Acres', 
            value: formatNumber(Math.round(stats.totalAcres)), 
            icon: MapPin,
            breakdown: `${currentYear}: ${formatNumber(Math.round(stats.currentYearAcres))} | ${prevYear}: ${formatNumber(Math.round(stats.prevYearAcres))}`
          },
          {
            label: "Today's Permits",
            value: formatNumber(stats.todayCount),
            icon: FileText,
            breakdown: stats.todayCounties > 0 ? `${stats.todayCounties} ${stats.todayCounties === 1 ? 'county' : 'counties'}` : undefined,
          },
          { label: "Today's Acres", value: formatNumber(Math.round(stats.todayAcres)), icon: MapPin },
          { label: 'Avg VI (Today)', value: formatNumber(Math.round(stats.avgVI)), icon: AlertTriangle },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{s.label}</span>
                </div>
                <p className="text-lg font-bold text-slate-900 leading-tight">{s.value}</p>
                {s.breakdown && (
                  <p className="text-[9px] text-slate-400 mt-1 font-medium border-t pt-1 border-slate-100">{s.breakdown}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live weather indicator */}
      {Object.keys(liveWeather).length > 0 && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Radio className="h-3 w-3 animate-pulse flex-shrink-0" />
          <span>
            Today&apos;s permits enriched with <strong>live NWS weather data</strong> for{' '}
            {(() => {
              const counties = Object.keys(liveWeather);
              const shown = counties.slice(0, 5).join(', ');
              return counties.length > 5 ? `${shown} +${counties.length - 5} more` : shown;
            })()}
          </span>
        </div>
      )}
      {weatherLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> Fetching live weather for today&apos;s permit counties...
        </div>
      )}

      {/* Top 10 Counties + Scatter Plot side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Counties */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">
              Top 10 Burning Counties (Acreage)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topCounties} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="county" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey={prevYear} fill="#E41A1C" name={String(prevYear)} />
                <Bar dataKey={currentYear} fill="#377EB8" name={String(currentYear)} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Smoke Dispersion Risk Scatter Plot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">
              Smoke Dispersion Risk Analysis (Today)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {smokeRiskData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 50 }}>
                  {/* Hyperbolic risk zone background */}
                  <Customized component={RiskZoneBackground} />
                  <XAxis
                    dataKey="windSpeed"
                    type="number"
                    domain={[0, 15]}
                    name="Wind Speed"
                    unit=" mph"
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Wind Speed (mph)', position: 'bottom', fontSize: 11, offset: 10 }}
                  />
                  <YAxis
                    dataKey="mixingHeight"
                    type="number"
                    domain={[0, 5000]}
                    name="Mixing Height"
                    unit=" ft"
                    tick={{ fontSize: 11 }}
                    label={{ value: 'Mixing Height (ft)', angle: -90, position: 'insideLeft', fontSize: 11, offset: -10 }}
                  />
                  <ZAxis dataKey="acres" range={[100, 1000]} name="Acres" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white border rounded-lg shadow-lg p-2 text-xs">
                          <p className="font-bold">{d.county}</p>
                          <p>Permits: {d.count}</p>
                          <p>Total Acres: {formatNumber(Math.round(d.acres))}</p>
                          <p>Wind: {d.windSpeed} mph</p>
                          <p>Mix Height: {formatNumber(d.mixingHeight)} ft</p>
                          <p>VI: {formatNumber(d.vi)}</p>
                          <p className="font-medium">{d.quality}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={smokeRiskData}
                    fillOpacity={0.85}
                    label={smokeRiskData.length <= 12
                      ? { dataKey: 'county', fill: '#475569', fontSize: 9, offset: 8, position: 'top' }
                      : undefined
                    }
                  >
                    {smokeRiskData.map((entry, i) => (
                      <Cell key={i} fill={PERMIT_DISPERSION_COLORS[entry.quality] || '#999'} stroke="#333" strokeWidth={1} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">No permit data with met data available for today.</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
              <span><span className="inline-block w-3 h-3 rounded" style={{ background: '#ef4444' }} /> Poor (VI &lt; 20k)</span>
              <span><span className="inline-block w-3 h-3 rounded" style={{ background: '#eab308' }} /> Fair (20k–40k)</span>
              <span><span className="inline-block w-3 h-3 rounded" style={{ background: '#22c55e' }} /> Good (VI &gt; 40k)</span>
              <span className="text-slate-400 italic">One point per county · bubble size = total acres</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Permit Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">
            Daily Permit Profile (Today)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {permitProfileData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={Math.max(180, permitProfileData.length * 44)}>
                <BarChart
                  data={permitProfileData}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 4, left: 160 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Number of Permits', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11 }} width={155} />
                  <Tooltip
                    formatter={(value: number | undefined, name: string | undefined) => [value ?? 0, `Manager: ${name ?? ''}`]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => `Certified Manager: ${v}`} />
                  <Bar dataKey="Yes" stackId="a" fill="#228B22" name="Yes">
                    <LabelList dataKey="Yes" position="inside" style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }}
                      formatter={(v: number | undefined) => (v ?? 0) > 0 ? v : ''} />
                  </Bar>
                  <Bar dataKey="No" stackId="a" fill="#CD5C5C" name="No">
                    <LabelList dataKey="No" position="inside" style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }}
                      formatter={(v: number | undefined) => (v ?? 0) > 0 ? v : ''} />
                  </Bar>
                  <Bar dataKey="Unknown" stackId="a" fill="#808080" name="Unknown" radius={[0, 3, 3, 0]}>
                    <LabelList dataKey="Unknown" position="inside" style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }}
                      formatter={(v: number | undefined) => (v ?? 0) > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-slate-400 mt-1">Stacked by certified burn manager status. Bars ordered by permit count.</p>
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No permits for today to display profile.</p>
          )}
        </CardContent>
      </Card>

      {/* Dispersion Quality Map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">
            Dispersion Quality Map (Today)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mapPermits.length > 0 ? (
            <PermitMaps
              key={`dispersion-${Object.keys(liveWeather).length}`}
              permits={mapPermits}
              type="dispersion"
            />
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No permit data available for today.</p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
            <span><span className="inline-block w-3 h-3 rounded" style={{ background: '#ef4444' }} /> Poor (Trapping)</span>
            <span><span className="inline-block w-3 h-3 rounded" style={{ background: '#eab308' }} /> Fair</span>
            <span><span className="inline-block w-3 h-3 rounded" style={{ background: '#22c55e' }} /> Good (Clearing)</span>
          </div>
        </CardContent>
      </Card>

      {/* Maps: Burn Density + Smoke Direction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">
              Daily Burn Density
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PermitMaps permits={mapPermits} type="density" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-500">
              Smoke Travel Direction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PermitMaps permits={mapPermits} type="smoke" />
          </CardContent>
        </Card>
      </div>

      {/* Permit Table with Date Range Filter */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-500">
            Burn Permits ({formatNumber(tablePermits.length)} records)
          </CardTitle>
          <div className="flex gap-1">
            {([
              ['today', 'Today'],
              ['week', 'This Week'],
              ['month', 'This Month'],
              ['6months', '6 Months'],
            ] as [DateRange, string][]).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={dateRange === key ? 'default' : 'outline'}
                className={dateRange === key ? 'bg-orange-600 hover:bg-orange-700 text-xs' : 'text-xs'}
                onClick={() => setDateRange(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b bg-slate-50">
                  {['Permit ID', 'Date', 'County', 'Type / Purpose', 'D/N', 'Mgr', 'Acres', 'Wind Dir', 'Wind Spd', 'Mix Ht', 'VI', 'Quality', 'Source'].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-medium text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tablePermits.slice(-200).reverse().map((p, i) => {
                  const isLive = p.permitDate === todayStr && liveWeather[p.county];
                  return (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500 whitespace-nowrap">{p.burnPermitId || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{p.permitDate}</td>
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{p.county}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {[p.burnType, p.burnPurpose].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {p.dayNight ? (
                          <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${p.dayNight === 'Day' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                            {p.dayNight}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {p.certBurnManager ? (
                          <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                            p.certBurnManager === 'Yes' ? 'bg-green-100 text-green-800' :
                            p.certBurnManager === 'No' ? 'bg-red-100 text-red-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>{p.certBurnManager}</span>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-1.5">{p.burnAcresEstimate}</td>
                      <td className="px-2 py-1.5">{p.windDirection}</td>
                      <td className="px-2 py-1.5">{p.windSpeed}</td>
                      <td className="px-2 py-1.5">{formatNumber(p.mixingHeight)}</td>
                      <td className="px-2 py-1.5">{formatNumber(p.ventilationIndex)}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: PERMIT_DISPERSION_COLORS[p.dispersionQuality] || '#eee',
                            color: p.dispersionQuality === 'Fair' ? '#854d0e' : (PERMIT_DISPERSION_COLORS[p.dispersionQuality] ? 'white' : '#555'),
                          }}
                        >
                          {p.dispersionQuality}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        {isLive ? (
                          <Badge className="bg-green-100 text-green-700 text-[9px]">NWS Live</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px]">MFC</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
