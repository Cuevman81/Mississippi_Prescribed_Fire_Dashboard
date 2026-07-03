// ============================================================
// Simple per-IP rate limiter for API routes
//
// In-memory fixed-window limiter. On Vercel each serverless
// instance keeps its own window, so this is burst protection
// against abusive clients rather than a precise global quota —
// sufficient for public read-only proxy routes. For a hard
// global limit, front with Vercel WAF or a shared store.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 5000;

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `${ip}:${request.nextUrl.pathname}`;
}

/**
 * Returns a 429 response if the client exceeded the limit, or null to proceed.
 *
 *   const limited = rateLimit(request, 30);
 *   if (limited) return limited;
 */
export function rateLimit(
  request: NextRequest,
  limit: number,
  windowMs: number = 60_000
): NextResponse | null {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > MAX_BUCKETS) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  const key = clientKey(request);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= limit) {
    return null;
  }

  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000)),
      },
    }
  );
}
