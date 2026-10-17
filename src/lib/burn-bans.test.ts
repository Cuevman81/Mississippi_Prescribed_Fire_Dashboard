import { describe, expect, it } from 'vitest';
import {
  BAN_DATA_STALE_MS,
  MS_COUNTY_COUNT,
  banSeverity,
  banStatusForLocation,
  buildBurnBanReport,
  parseBanCsv,
  parseCountyLayer,
  type BurnBanResult,
} from './burn-bans';

// Rows copied from MFC's ms_counties_burn_ban_info.csv on 2026-10-17, quirks
// included: "TRUE " with a trailing space, " " in empty cells, and the _MS
// suffix on county names shared with other states
const CSV = `county_name,allow_burn,allow_exemptions,mfc_exemption_1,cbm_exemption_2,cfs_exemption_3,cc_exemption_4,afb_exemption_5,forecast_type,mixing_height,transport_wind_speed,transport_wind_dir,stag_index,red_flag,air_quality,mfc_ban,mfc_manually_approved
Adams,True,True,,,,,,Day,1530,9,NE,2,True,,,
Amite,False,True,TRUE ,TRUE,,TRUE,,Day,1500,9,NE,2,True,,,
Carroll,False,True,TRUE ,,TRUE,TRUE,,Day,1550,9,N,2,True,,,
Franklin_MS,False,True,TRUE ,TRUE,,TRUE,,Day,1530,9,NE,2,True,,,
Hinds,True,True,,,,,,Day,1530,9,NE,2,True,,,
Leake,False,True,TRUE ,,,,,Day,1530,9,NE,2,True,,,
Rankin,False,True,TRUE ,TRUE,TRUE,TRUE,,Day,1530,9,NE,2,True,,,
`;

/** A county layer with all 82 counties; `bans` maps county name -> overrides */
function layer(bans: Record<string, { csv?: string; mfc?: 0 | 1 }> = {}, count = MS_COUNTY_COUNT) {
  const named = ['Adams', 'Amite', 'Carroll', 'Franklin', 'Hinds', 'Leake', 'Rankin'];
  const names = [...named, ...Array.from({ length: count - named.length }, (_, i) => `County${i + 1}`)];
  return {
    type: 'FeatureCollection',
    features: names.map((NAME) => ({
      type: 'Feature',
      geometry: null,
      properties: {
        NAME,
        county_name_csv_match: bans[NAME]?.csv ?? NAME,
        hasCountyBan: NAME in bans ? 1 : 0,
        hasMFCBan: bans[NAME]?.mfc ?? 0,
      },
    })),
  };
}

describe('parseBanCsv', () => {
  const csv = parseBanCsv(CSV);

  it('reads exemptions despite trailing spaces in the cells', () => {
    expect(csv.get('amite')?.exemptions).toEqual([1, 2, 4]);
    expect(csv.get('rankin')?.exemptions).toEqual([1, 2, 3, 4]);
    expect(csv.get('leake')?.exemptions).toEqual([1]);
  });

  it('reads a county with no exemptions as an empty list, not as unknown', () => {
    expect(csv.get('adams')?.exemptions).toEqual([]);
  });

  it('keys counties by MFC\'s CSV name, suffix included', () => {
    expect(csv.get('franklin_ms')?.exemptions).toEqual([1, 2, 4]);
  });

  it('handles CRLF line endings and a byte-order mark', () => {
    const crlf = parseBanCsv('﻿' + CSV.replace(/\n/g, '\r\n'));
    expect(crlf.get('carroll')?.exemptions).toEqual([1, 3, 4]);
  });

  it('rejects a CSV that lost the exemption columns', () => {
    expect(() => parseBanCsv('county_name,allow_burn\nAmite,False\n')).toThrow(/missing columns/);
  });

  it('rejects an ArcGIS error body served in place of the CSV', () => {
    expect(() => parseBanCsv('{"error":{"code":403,"message":"You do not have permissions"}}')).toThrow();
  });
});

describe('parseCountyLayer', () => {
  it('reads all 82 counties and their ban flags', () => {
    const rows = parseCountyLayer(layer({ Amite: {}, Franklin: { csv: 'Franklin_MS' } }));
    expect(rows).toHaveLength(MS_COUNTY_COUNT);
    expect(rows.filter((r) => r.countyBan).map((r) => r.name)).toEqual(['Amite', 'Franklin']);
    expect(rows.find((r) => r.name === 'Franklin')?.csvKey).toBe('franklin_ms');
  });

  it('rejects an incomplete county list instead of reading it as fewer bans', () => {
    expect(() => parseCountyLayer(layer({}, 40))).toThrow(/expected 82/);
    expect(() => parseCountyLayer({ features: [] })).toThrow(/expected 82/);
  });

  it('rejects a county whose ban flag is missing', () => {
    const l = layer();
    (l.features[3].properties as Record<string, unknown>).hasCountyBan = null;
    expect(() => parseCountyLayer(l)).toThrow(/malformed/);
  });

  it('rejects a response that is not a feature collection', () => {
    expect(() => parseCountyLayer({ error: { code: 500 } })).toThrow(/no features/);
    expect(() => parseCountyLayer(null)).toThrow(/no features/);
  });
});

describe('buildBurnBanReport', () => {
  const now = Date.parse('2026-10-17T15:00:00Z');
  const counties = parseCountyLayer(
    layer({ Amite: {}, Carroll: {}, Franklin: { csv: 'Franklin_MS' }, Rankin: {} })
  );

  it('lists banned counties alphabetically with their exemptions', () => {
    const r = buildBurnBanReport({ counties, csv: parseBanCsv(CSV), asOf: now - 3600_000, now });
    expect(r.bannedCounties).toEqual([
      { name: 'Amite', mfcBan: false, exemptions: [1, 2, 4] },
      { name: 'Carroll', mfcBan: false, exemptions: [1, 3, 4] },
      { name: 'Franklin', mfcBan: false, exemptions: [1, 2, 4] },
      { name: 'Rankin', mfcBan: false, exemptions: [1, 2, 3, 4] },
    ]);
    expect(r.asOf).toBe('2026-10-17T14:00:00.000Z');
    expect(r.stale).toBe(false);
    expect(r.exemptionsAvailable).toBe(true);
  });

  it('marks exemptions unknown, not empty, when the CSV is unavailable', () => {
    const r = buildBurnBanReport({ counties, csv: null, asOf: now, now });
    expect(r.exemptionsAvailable).toBe(false);
    expect(r.bannedCounties.every((b) => b.exemptions === null)).toBe(true);
  });

  it('flags data MFC has not updated in over a day', () => {
    const r = buildBurnBanReport({ counties, csv: null, asOf: now - BAN_DATA_STALE_MS - 1, now });
    expect(r.stale).toBe(true);
  });

  it('includes an MFC ban even where the county itself has none', () => {
    const r = buildBurnBanReport({ counties: parseCountyLayer(layer({ Hinds: {} })).map((c) => (c.name === 'Adams' ? { ...c, mfcBan: true } : c)), csv: null, asOf: now, now });
    expect(r.bannedCounties.map((b) => [b.name, b.mfcBan])).toEqual([['Adams', true], ['Hinds', false]]);
  });
});

describe('banStatusForLocation', () => {
  const now = Date.parse('2026-10-17T15:00:00Z');
  const report = buildBurnBanReport({
    counties: parseCountyLayer(layer({ Amite: {}, Carroll: {}, Leake: {} })),
    csv: parseBanCsv(CSV),
    asOf: now,
    now,
  });
  const unavailable: BurnBanResult = { available: false, reason: 'down', source: '' };

  it('says "unavailable", never "no ban", when the source failed', () => {
    const s = banStatusForLocation(unavailable, 'Hinds');
    expect(s.effect).toBe('unknown');
    expect(s.message).toMatch(/burn ban status unavailable/i);
    expect(banStatusForLocation(null, 'Hinds').effect).toBe('unknown');
  });

  it('warns, without vetoing, when the order exempts certified burn managers', () => {
    const s = banStatusForLocation(report, 'Amite');
    expect(s.effect).toBe('warning');
    expect(s.message).toMatch(/certified burn managers exempt/);
  });

  it('vetoes when the order does not exempt certified burn managers', () => {
    expect(banStatusForLocation(report, 'Carroll').effect).toBe('restricted');
    expect(banStatusForLocation(report, 'Leake').effect).toBe('restricted');
  });

  it('vetoes an MFC ban whatever the exemptions', () => {
    const r = { ...report, bannedCounties: [{ name: 'Amite', mfcBan: true, exemptions: [1, 2, 4] }] };
    expect(banStatusForLocation(r, 'Amite').effect).toBe('restricted');
  });

  it('warns that exemption status is unknown when exemptions could not be read', () => {
    const r = { ...report, bannedCounties: [{ name: 'Carroll', mfcBan: false, exemptions: null }] };
    const s = banStatusForLocation(r, 'Carroll');
    expect(s.effect).toBe('warning');
    expect(s.message).toMatch(/exemption status unknown/);
  });

  it('reports no ban for an unbanned county, matching names case-insensitively', () => {
    expect(banStatusForLocation(report, 'Hinds').effect).toBe('none');
    expect(banStatusForLocation(report, 'AMITE').effect).toBe('warning');
  });

  it('does not confirm "no ban" from stale data', () => {
    expect(banStatusForLocation({ ...report, stale: true }, 'Hinds').effect).toBe('unknown');
  });

  it('treats a failed county lookup as unknown, and outside Mississippi as not applicable', () => {
    expect(banStatusForLocation(report, undefined).effect).toBe('unknown');
    expect(banStatusForLocation(report, null).effect).toBe('none');
  });

  it('gives map severities that match the veto rule', () => {
    expect(banSeverity({ name: 'A', mfcBan: false, exemptions: [1, 2] })).toBe('exempt');
    expect(banSeverity({ name: 'A', mfcBan: false, exemptions: [1] })).toBe('restricted');
    expect(banSeverity({ name: 'A', mfcBan: false, exemptions: null })).toBe('unknown');
    expect(banSeverity({ name: 'A', mfcBan: true, exemptions: [2] })).toBe('restricted');
  });
});
