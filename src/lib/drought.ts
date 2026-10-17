// U.S. Drought Monitor helpers

/**
 * The map's valid date from the shapefile name inside USDM_current_M.zip
 * (e.g. "USDM_20261013" -> "2026-10-13"). USDM maps are valid as of a
 * Tuesday and released that Thursday. Returns null if the name doesn't
 * carry a real date, so the page never shows a made-up one.
 */
export function usdmValidDate(fileName: string | undefined): string | null {
  const m = /USDM_(\d{4})(\d{2})(\d{2})/i.exec(fileName ?? '');
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +mo - 1 || date.getUTCDate() !== +d) return null;
  return `${y}-${mo}-${d}`;
}

/** "Oct 13, 2026" for a YYYY-MM-DD date, without shifting it through a time zone */
export function formatUsdmDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  });
}
