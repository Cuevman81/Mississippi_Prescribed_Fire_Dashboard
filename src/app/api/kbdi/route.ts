import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

// ============================================================
// Real Keetch-Byram Drought Index (KBDI)
//
// Keetch & Byram (1968), USDA Forest Service RP SE-38, with the
// corrected drought-factor equation per Alexander (1990),
// "Computer Calculation of the Keetch-Byram Drought Index —
// Programmers Beware!", Fire Management Notes 51(4):
//
//   dQ = [800 - Q][0.968 exp(0.0486 T) - 8.30] * 1e-3
//        / [1 + 10.88 exp(-0.0441 R)]
//
// where Q = yesterday's KBDI reduced by today's net rainfall
// (amount in excess of 0.20 in, withheld once per rain event),
// T = daily max temp (F), R = mean annual rainfall (in).
//
// Daily temperature and precipitation come from NOAA/RCC ACIS
// (PRISM grid). The index is initialized at 0 in midwinter ~18
// months back — Southeastern soils saturate every winter, so
// initialization error washes out long before the present.
// ============================================================

const ACIS_URL = 'https://data.rcc-acis.org/GridData';

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 10);
  if (limited) return limited;

  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing lat/lon' }, { status: 400 });
  }
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum) || latNum < 24 || latNum > 50 || lonNum < -125 || lonNum > -66) {
    return NextResponse.json({ error: 'Coordinates must be within the continental U.S.' }, { status: 400 });
  }

  // Round to ~1 km so nearby requests share the upstream cache entry
  const latR = latNum.toFixed(2);
  const lonR = lonNum.toFixed(2);

  // Start Jan 1 of the previous year: a midwinter saturation point
  const now = new Date();
  const startYear = now.getUTCFullYear() - 1;
  const sdate = `${startYear}-01-01`;
  const edate = now.toISOString().split('T')[0];

  try {
    const res = await fetch(ACIS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loc: `${lonR},${latR}`,
        sdate,
        edate,
        grid: '21', // PRISM daily
        elems: [{ name: 'maxt' }, { name: 'pcpn' }],
      }),
      next: { revalidate: 21600 }, // 6 h — daily data, ~1-day lag
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Climate data service unavailable' }, { status: 502 });
    }

    const payload = await res.json();
    const rows: Array<[string, number | string, number | string]> = payload.data || [];

    if (rows.length < 200) {
      return NextResponse.json({ error: 'Insufficient climate history for KBDI' }, { status: 502 });
    }

    // Parse. ACIS grid data flags missing values as -999; trailing days
    // (PRISM lags ~1 day) come back missing.
    const days = rows
      .map(([date, maxt, pcpn]) => ({
        date,
        maxt: typeof maxt === 'number' && maxt > -90 ? maxt : NaN,
        pcpn: typeof pcpn === 'number' && pcpn >= 0 ? pcpn : NaN,
      }))
      .filter((d) => !isNaN(d.maxt) && !isNaN(d.pcpn));

    if (days.length < 200) {
      return NextResponse.json({ error: 'Insufficient climate history for KBDI' }, { status: 502 });
    }

    // Mean annual rainfall R from the trailing 365 days of data
    const last365 = days.slice(-365);
    const annualRain = last365.reduce((s, d) => s + d.pcpn, 0);
    const R = Math.max(10, annualRain * (365 / last365.length));

    let q = 0; // KBDI, in hundredths of an inch (0-800)
    let eventRain = 0; // accumulated rain within the current wet spell
    let eventCredited = 0; // net rain already subtracted this wet spell
    let lastDate = '';

    for (const day of days) {
      // --- Rainfall reduction first (Alexander 1990) ---
      if (day.pcpn > 0) {
        eventRain += day.pcpn;
        // Only rainfall in excess of 0.20" per event reduces the index,
        // and the threshold is withheld once per consecutive wet spell
        const net = Math.max(0, eventRain - 0.2) - eventCredited;
        if (net > 0) {
          q = Math.max(0, q - 100 * net);
          eventCredited += net;
        }
      } else {
        eventRain = 0;
        eventCredited = 0;
      }

      // --- Drought factor (potential evapotranspiration) ---
      if (!isNaN(day.maxt)) {
        const numerator = (800 - q) * (0.968 * Math.exp(0.0486 * day.maxt) - 8.3) * 1e-3;
        const dq = numerator / (1 + 10.88 * Math.exp(-0.0441 * R));
        if (dq > 0) q += dq; // factor goes negative below ~50 F; no drying
      }

      q = Math.max(0, Math.min(800, q));
      lastDate = day.date;
    }

    const kbdi = Math.round(q);

    let category: string;
    let description: string;
    if (kbdi < 200) {
      category = 'Low';
      description = 'Soil and duff moist; little drought contribution to fire behavior.';
    } else if (kbdi < 400) {
      category = 'Moderate';
      description = 'Litter and duff drying; typical of late spring / early growing season.';
    } else if (kbdi < 600) {
      category = 'High';
      description = 'Lower litter and duff dry; expect increased fuel consumption and smoldering.';
    } else {
      category = 'Severe';
      description = 'Severe drought. Intense burning, deep duff and organic soil consumption likely. Associated with extreme fire danger.';
    }

    return NextResponse.json(
      {
        kbdi,
        category,
        description,
        asOfDate: lastDate,
        annualRainfallIn: Math.round(R * 10) / 10,
        source: 'Computed from NOAA/RCC ACIS (PRISM) daily data per Keetch & Byram (1968), Alexander (1990) correction',
      },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600' } }
    );
  } catch (err) {
    console.error('KBDI API error:', err);
    return NextResponse.json({ error: 'KBDI computation failed' }, { status: 500 });
  }
}
