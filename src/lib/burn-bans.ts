// ============================================================
// Mississippi county burn bans (Mississippi Forestry Commission)
//
// Source: MFC's own ArcGIS items that drive its Survey123 burn
// permit application (owner Developer_mfcgis). Both are public
// and county-level only — no applicant or landowner data.
//
//  - County layer: one polygon per county with hasCountyBan /
//    hasMFCBan flags; its editingInfo.dataLastEditDate is the
//    "as of" time (MFC's notebook refreshes it hourly).
//  - ms_counties_burn_ban_info CSV: the per-order exemptions
//    from MFC's exemption key (1-5).
//
// Legal basis: Miss. Code § 49-19-351 lets a county Board of
// Supervisors "prohibit or restrict" outdoor burning once MFC
// finds drought or wildfire conditions. The statute has no
// blanket exemption for prescribed burning; each order lists
// its own exemptions. MFC exemption #2 is Certified Burn
// Managers, so whether a ban stops a certified prescribed burn
// depends on that county's order.
// ============================================================

export const MFC_COUNTY_LAYER =
  'https://services5.arcgis.com/hE6urTTXj32LRUqx/arcgis/rest/services/MFC_Burn_Permits_County_Boundaries/FeatureServer/0';
export const MFC_BAN_CSV =
  'https://www.arcgis.com/sharing/rest/content/items/e909364200594201a846c2f46326313a/data';
export const MFC_BURN_BAN_PAGE = 'https://www.mfc.ms.gov/burning-info/burn-bans/';

export const MS_COUNTY_COUNT = 82;
/** MFC refreshes the layer hourly; a day without an update means the feed has stalled */
export const BAN_DATA_STALE_MS = 24 * 60 * 60 * 1000;

/** MFC's Burn Ban Exemptions Key (mfc.ms.gov). #6 "Other" has no column in MFC's feed. */
export const EXEMPTION_LABELS: Record<number, string> = {
  1: 'Mississippi Forestry Commission',
  2: 'Certified Burn Managers',
  3: 'County Fire Services',
  4: 'Commercial contractors (heavy equipment, MDEQ rules)',
  5: 'Agricultural field burn',
};
export const CERTIFIED_BURN_MANAGER_EXEMPTION = 2;

const EXEMPTION_COLUMNS: Record<number, string> = {
  1: 'mfc_exemption_1',
  2: 'cbm_exemption_2',
  3: 'cfs_exemption_3',
  4: 'cc_exemption_4',
  5: 'afb_exemption_5',
};

export interface BannedCounty {
  name: string;
  /** MFC-level ban: per MFC, no burning regardless of exemptions */
  mfcBan: boolean;
  /** Exemption numbers listed on the order; null when MFC's exemption data couldn't be read */
  exemptions: number[] | null;
}

export interface BurnBanReport {
  available: true;
  /** When MFC last updated the county layer (ISO), or null if not reported */
  asOf: string | null;
  stale: boolean;
  /** Whether the exemptions CSV was read; when false every county's exemptions are null */
  exemptionsAvailable: boolean;
  bannedCounties: BannedCounty[];
  source: string;
}

export interface BurnBanUnavailable {
  available: false;
  reason: string;
  source: string;
}

export type BurnBanResult = BurnBanReport | BurnBanUnavailable;

interface CountyRow {
  name: string;
  csvKey: string;
  countyBan: boolean;
  mfcBan: boolean;
}

const isTrue = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'true';
const normKey = (s: unknown) => String(s ?? '').trim().toLowerCase();

/**
 * Parse the county layer's GeoJSON query response. Throws if it isn't a
 * complete, well-formed list of all 82 counties, so a partial or changed
 * response can never be read as "no bans".
 */
export function parseCountyLayer(geojson: unknown): CountyRow[] {
  const features = (geojson as { features?: unknown })?.features;
  if (!Array.isArray(features)) throw new Error('county layer: no features');

  const rows: CountyRow[] = [];
  for (const f of features) {
    const p = (f as { properties?: Record<string, unknown> })?.properties ?? {};
    const name = String(p.NAME ?? '').trim();
    const ban = p.hasCountyBan;
    if (!name || (ban !== 0 && ban !== 1)) {
      throw new Error(`county layer: malformed county ${name || '(unnamed)'}`);
    }
    rows.push({
      name,
      csvKey: normKey(p.county_name_csv_match || name),
      countyBan: ban === 1,
      mfcBan: p.hasMFCBan === 1,
    });
  }

  const unique = new Set(rows.map((r) => r.name.toLowerCase()));
  if (unique.size !== MS_COUNTY_COUNT) {
    throw new Error(`county layer: expected ${MS_COUNTY_COUNT} counties, got ${unique.size}`);
  }
  return rows;
}

/** Minimal RFC 4180 line splitter (MFC's CSV has no quoted fields today, but don't depend on it) */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export interface CsvCountyInfo {
  exemptions: number[];
  mfcBan: boolean;
}

/**
 * Parse MFC's ms_counties_burn_ban_info CSV into exemptions per county,
 * keyed by the lowercased county_name (which the county layer carries as
 * county_name_csv_match, e.g. "benton_ms"). Throws if the columns this
 * depends on are missing.
 */
export function parseBanCsv(text: string): Map<string, CsvCountyInfo> {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('ban CSV: empty');

  const header = splitCsvLine(lines[0]).map(normKey);
  const col = (name: string) => header.indexOf(name);
  const required = ['county_name', ...Object.values(EXEMPTION_COLUMNS)];
  const missing = required.filter((c) => col(c) < 0);
  if (missing.length) throw new Error(`ban CSV: missing columns ${missing.join(', ')}`);

  const mfcBanCol = col('mfc_ban');
  const result = new Map<string, CsvCountyInfo>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const county = normKey(cells[col('county_name')]);
    if (!county) continue;
    const exemptions = Object.entries(EXEMPTION_COLUMNS)
      .filter(([, c]) => isTrue(cells[col(c)]))
      .map(([n]) => Number(n));
    result.set(county, { exemptions, mfcBan: mfcBanCol >= 0 && isTrue(cells[mfcBanCol]) });
  }
  return result;
}

/** Combine the county layer (authoritative ban list) with the CSV (exemptions). */
export function buildBurnBanReport(opts: {
  counties: CountyRow[];
  csv: Map<string, CsvCountyInfo> | null;
  asOf: number | null;
  now?: number;
}): BurnBanReport {
  const { counties, csv, asOf } = opts;
  const now = opts.now ?? Date.now();

  const bannedCounties: BannedCounty[] = counties
    .filter((c) => c.countyBan || c.mfcBan)
    .map((c) => {
      const info = csv?.get(c.csvKey);
      return {
        name: c.name,
        mfcBan: c.mfcBan || Boolean(info?.mfcBan),
        exemptions: info ? info.exemptions : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    available: true,
    asOf: asOf ? new Date(asOf).toISOString() : null,
    stale: asOf ? now - asOf > BAN_DATA_STALE_MS : false,
    exemptionsAvailable: csv !== null,
    bannedCounties,
    source: MFC_BURN_BAN_PAGE,
  };
}

// ------------------------------------------------------------
// What a ban means for a burn at the selected location
// ------------------------------------------------------------

export type BanEffect =
  /** Ban without a Certified Burn Manager exemption, or an MFC ban: veto */
  | 'restricted'
  /** Ban whose order exempts certified burn managers, or exemptions unknown: prominent warning */
  | 'warning'
  /** Ban status couldn't be confirmed: fail closed, never green */
  | 'unknown'
  | 'none';

export interface LocationBanStatus {
  effect: BanEffect;
  county: string | null;
  ban: BannedCounty | null;
  message: string;
}

/**
 * Decide what the burn status card shows for the selected county.
 * `county` is null when the point is outside Mississippi, undefined when the
 * county lookup itself failed.
 */
export function banStatusForLocation(
  result: BurnBanResult | null,
  county: string | null | undefined
): LocationBanStatus {
  if (!result || !result.available) {
    return { effect: 'unknown', county: county ?? null, ban: null, message: 'Burn ban status unavailable — verify at mfc.ms.gov' };
  }
  if (county === null) {
    return { effect: 'none', county: null, ban: null, message: 'Outside Mississippi — MFC county burn bans do not apply' };
  }
  if (county === undefined) {
    return { effect: 'unknown', county: null, ban: null, message: 'Could not determine the county for this location — check the burn ban list' };
  }

  const ban = result.bannedCounties.find((b) => b.name.toLowerCase() === county.toLowerCase()) ?? null;
  if (!ban) {
    if (result.stale) {
      return { effect: 'unknown', county, ban: null, message: 'MFC burn ban data may be out of date — verify at mfc.ms.gov' };
    }
    return { effect: 'none', county, ban: null, message: `No burn ban in ${county} County` };
  }

  if (ban.mfcBan) {
    return { effect: 'restricted', county, ban, message: `MFC burn ban in ${county} County — no burning regardless of exemptions` };
  }
  if (ban.exemptions === null) {
    return { effect: 'warning', county, ban, message: `${county} County burn ban — exemption status unknown; check the county order with MFC` };
  }
  if (ban.exemptions.includes(CERTIFIED_BURN_MANAGER_EXEMPTION)) {
    return { effect: 'warning', county, ban, message: `${county} County burn ban — certified burn managers exempt under this order` };
  }
  return { effect: 'restricted', county, ban, message: `${county} County burn ban — certified burn managers NOT exempt` };
}

/** Map styling class for a banned county (shared by the list and the maps) */
export function banSeverity(ban: BannedCounty): 'restricted' | 'exempt' | 'unknown' {
  if (ban.mfcBan) return 'restricted';
  if (ban.exemptions === null) return 'unknown';
  return ban.exemptions.includes(CERTIFIED_BURN_MANAGER_EXEMPTION) ? 'exempt' : 'restricted';
}

/** What /api/burn-bans returns */
export type BurnBanResponse = BurnBanResult & {
  location?: { county: string | null; lookupFailed: boolean };
  geojson?: GeoJSON.FeatureCollection;
};

/** Fill colors for banned counties, shared by the maps and the list legend */
export const BAN_COLORS: Record<ReturnType<typeof banSeverity>, string> = {
  restricted: '#dc2626', // red-600: certified burn managers not exempt, or MFC ban
  exempt: '#f97316', // orange-500: certified burn managers exempt under the order
  unknown: '#eab308', // yellow-500: exemptions could not be read
};

/** "Oct 17, 10:05 AM CDT" in Mississippi time */
export function formatBanTime(iso: string | null): string {
  if (!iso) return 'unknown';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
}
