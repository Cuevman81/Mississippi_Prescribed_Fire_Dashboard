'use client';

import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { useDashboard } from '@/lib/dashboard-context';
import { BAN_COLORS, banSeverity, type BannedCounty } from '@/lib/burn-bans';

// County outlines are fetched once per page load and shared by every map
let outlinePromise: Promise<GeoJSON.FeatureCollection | null> | null = null;
function loadOutlines() {
  outlinePromise ??= fetch('/api/burn-bans?geometry=1')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.geojson as GeoJSON.FeatureCollection) ?? null)
    .catch(() => null)
    .then((g) => {
      if (!g) outlinePromise = null; // allow a retry on the next mount
      return g;
    });
  return outlinePromise;
}

export function useCountyOutlines() {
  const [outlines, setOutlines] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    let live = true;
    loadOutlines().then((g) => { if (live) setOutlines(g); });
    return () => { live = false; };
  }, []);
  return outlines;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SEVERITY_TEXT = {
  restricted: 'Burn ban: certified burn managers NOT exempt',
  exempt: 'Burn ban: certified burn managers exempt',
  unknown: 'Burn ban: exemptions unknown',
};

/** MFC county burn bans drawn over a Leaflet map (place inside a MapContainer) */
export function BurnBanLayer({ showAllOutlines = false }: { showAllOutlines?: boolean }) {
  const { burnBans } = useDashboard();
  const outlines = useCountyOutlines();
  if (!outlines || !burnBans?.available) return null;

  const byName = new Map<string, BannedCounty>(
    burnBans.bannedCounties.map((b) => [b.name.toLowerCase(), b])
  );
  const banFor = (f?: GeoJSON.Feature) => byName.get(String(f?.properties?.name ?? '').toLowerCase());

  return (
    <GeoJSON
      // react-leaflet's GeoJSON doesn't restyle on prop changes; remount instead
      key={`${burnBans.asOf}-${burnBans.bannedCounties.length}-${showAllOutlines}`}
      data={outlines}
      filter={(f) => showAllOutlines || Boolean(banFor(f))}
      style={(f) => {
        const ban = banFor(f);
        return ban
          ? { fillColor: BAN_COLORS[banSeverity(ban)], fillOpacity: 0.35, color: BAN_COLORS[banSeverity(ban)], weight: 1 }
          : { fillOpacity: 0, color: '#64748b', weight: 0.5 };
      }}
      onEachFeature={(f, layer) => {
        const ban = banFor(f);
        const name = escapeHtml(String(f.properties?.name ?? ''));
        layer.bindTooltip(
          `<b>${name} County</b><br/>${ban ? SEVERITY_TEXT[banSeverity(ban)] : 'No burn ban'}`,
          { sticky: true }
        );
      }}
    />
  );
}
