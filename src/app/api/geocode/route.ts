import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // Nominatim's usage policy caps clients at ~1 req/sec; keep our own
  // callers well under it and cache repeated queries for a day.
  const limited = rateLimit(request, 15);
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length > 100) {
    return NextResponse.json({ error: 'Invalid or missing query parameter (max 100 characters)' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=us&addressdetails=1`,
      {
        headers: {
          'User-Agent': process.env.NWS_USER_AGENT || 'PrescribedBurnApp/3.0',
        },
        next: { revalidate: 86400 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoding failed' }, { status: res.status });
    }

    const data = await res.json();

    const results = data.map((item: Record<string, unknown>) => ({
      lat: parseFloat(item.lat as string),
      lon: parseFloat(item.lon as string),
      displayName: item.display_name,
      city: (item.address as Record<string, string>)?.city ||
            (item.address as Record<string, string>)?.town ||
            (item.address as Record<string, string>)?.village || '',
      state: (item.address as Record<string, string>)?.state || '',
      stateAbbr: getStateAbbr((item.address as Record<string, string>)?.state || ''),
    }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 500 });
  }
}

function getStateAbbr(stateName: string): string {
  const states: Record<string, string> = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY',
  };
  return states[stateName] || '';
}
