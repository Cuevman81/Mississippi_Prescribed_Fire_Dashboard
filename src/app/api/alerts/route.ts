import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const NWS_HEADERS = {
  'User-Agent': process.env.NWS_USER_AGENT || 'PrescribedBurnApp/3.0',
  'Accept': 'application/geo+json',
};

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 30);
  if (limited) return limited;

  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');
  const nwsOffice = request.nextUrl.searchParams.get('office');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing lat/lon' }, { status: 400 });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  if (nwsOffice && !/^[A-Za-z0-9]{3,10}$/.test(nwsOffice)) {
    return NextResponse.json({ error: 'Invalid office parameter' }, { status: 400 });
  }

  try {
    // Get forecast zone for alert checking
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      { headers: NWS_HEADERS }
    );

    let alerts: unknown[] = [];
    let fireDiscussion = '';
    let zoneForecast = '';
    let burnBanInfo = '';

    if (pointRes.ok) {
      const pointData = await pointRes.json();
      const forecastZone = pointData.properties?.forecastZone;

      if (forecastZone) {
        const zoneId = forecastZone.split('/').pop();

        // Fetch active alerts for this zone
        const alertsRes = await fetch(
          `https://api.weather.gov/alerts/active/zone/${zoneId}`,
          { headers: NWS_HEADERS }
        );

        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          alerts = (alertsData.features || [])
            .filter((f: { properties: { event: string } }) => {
              const evt = f.properties.event.toLowerCase();
              return (
                evt.includes('red flag') ||
                evt.includes('fire weather') ||
                evt.includes('wind') ||
                evt.includes('heat') ||
                evt.includes('air quality')
              );
            })
            .map((f: { properties: Record<string, unknown> }) => ({
              event: f.properties.event,
              headline: f.properties.headline,
              description: f.properties.description,
              severity: f.properties.severity,
              onset: f.properties.onset,
              expires: f.properties.expires,
            }));
        }
      }
    }

    // Get fire weather discussion (FWF product)
    if (nwsOffice) {
      try {
        const fwfRes = await fetch(
          `https://api.weather.gov/products/types/FWF/locations/${nwsOffice}`,
          { headers: NWS_HEADERS }
        );

        if (fwfRes.ok) {
          const fwfList = await fwfRes.json();
          const latest = fwfList['@graph']?.[0];

          if (latest?.['@id']) {
            const productRes = await fetch(latest['@id'], { headers: NWS_HEADERS });
            if (productRes.ok) {
              const productData = await productRes.json();
              const fullText = productData.productText || '';

              // Extract .DISCUSSION... section
              const discussionMatch = fullText.match(
                /\.DISCUSSION[\s\S]*?(?=\n\n[A-Z]{2}Z\d{3}|\n\n\.|&&|\$\$)/
              );
              fireDiscussion = discussionMatch ? discussionMatch[0].trim() : '';

              // Extract zone-specific forecast (everything after discussion)
              const zoneSections = fullText.split('$$');
              if (zoneSections.length > 1) {
                zoneForecast = zoneSections.slice(1).join('\n---\n').trim();
              }
            }
          }
        }
      } catch {
        // Fire discussion not available — non-critical
      }

      // Check for burn ban notifications (FWN product)
      try {
        const fwnRes = await fetch(
          `https://api.weather.gov/products/types/FWN/locations/${nwsOffice}`,
          { headers: NWS_HEADERS }
        );

        if (fwnRes.ok) {
          const fwnList = await fwnRes.json();
          const latest = fwnList['@graph']?.[0];

          if (latest?.['@id']) {
            const productRes = await fetch(latest['@id'], { headers: NWS_HEADERS });
            if (productRes.ok) {
              const productData = await productRes.json();
              const text = (productData.productText || '').toLowerCase();
              if (text.includes('burn ban')) {
                burnBanInfo = productData.productText;
              }
            }
          }
        }
      } catch {
        // Burn ban check not available — non-critical
      }
    }

    return NextResponse.json({
      alerts,
      fireDiscussion,
      zoneForecast,
      burnBanInfo,
    });
  } catch (err) {
    console.error('Alerts API error:', err);
    return NextResponse.json({ error: 'Alerts service unavailable' }, { status: 500 });
  }
}
