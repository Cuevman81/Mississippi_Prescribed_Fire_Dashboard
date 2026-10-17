# Mississippi Prescribed Fire Weather Dashboard

[![View Live Dashboard](https://img.shields.io/badge/🚀-View%20Live%20Dashboard-orange?style=for-the-badge)](https://mississippi-prescribed-fire-dashboa.vercel.app/)

A comprehensive web-based decision support tool for prescribed fire managers, providing real-time weather, air quality, and fire behavior indices.

## 🚀 Key Features

The site has a dashboard plus pages for Forecast, Burn Windows, Air Quality, Fire & Smoke, Permits, Drought, Safety and a printable summary. Search for any U.S. place (OpenStreetMap Nominatim) or click the map to set the burn unit's location.

### 1. Dashboard
*   **Burn Status Summary:** "Within/Outside Prescription" for the current forecast hour, with a reason chip for each threshold missed (temperature, RH, wind, ventilation index).
*   **Critical Fire Alerts ("Veto"):** NWS Red Flag Warnings, Fire Weather Watches, Fire Warnings, Extreme Fire Danger and Extreme Heat Warnings turn the status card to BURN VETOED / RESTRICTED. Dense Smoke, Air Stagnation and Dense Fog advisories are always shown. Alerts auto-refresh every 5 minutes, and if NWS alerts cannot be checked the status card says so instead of showing green.
*   **County Burn Bans:** Statewide list of Mississippi counties under a burn ban, from Mississippi Forestry Commission (MFC) data, with an "as of" time, a link to MFC, each order's exemptions, and banned counties highlighted on the maps. If the selected location is in a banned county, the status card shows it prominently (see [County Burn Bans](#county-burn-bans) for when a ban vetoes the burn).
*   **Fuel and drought alerts:** Banners when fine dead fuel moisture falls below the 7% southern Rx floor (red below 5%) and when observed KBDI is above 600.
*   **Current Conditions:** Latest observation from the nearest ASOS/AWOS station (via the Iowa Environmental Mesonet), alongside the NWS gridded forecast. It falls back to the forecast hour when the observation is more than 2 hours old. A "Rain Detected Nearby" badge and days since rain are shown.
*   **Smoke Dispersion:** Ventilation index category, Lavdas Atmospheric Dispersion Index with stability class, and the overnight peak LVORI (smoke/fog road risk).
*   **Fire Weather Indices:** Surface and transport wind, mixing height, Haines index, precipitation chance, KBDI, Fosberg FWI, 1/10/100-hour fuel moisture and ignition probability.
*   **Burn Window Outlook:** The next three runs of hours in the coming 72 that meet the active prescription.
*   **Charts:** 24-hour burn quality score and a 48-hour temperature/RH/wind trend.

### 2. Prescription (Rx) Settings
*   **Presets:** Default, Grassland / Fuel Model 1, Pine Understory, and Site Prep / High Fuel.
*   **Custom thresholds:** Sliders for RH, wind, temperature, minimum ventilation index and days since rain. Settings are saved in the browser.

### 3. Pages
*   **Forecast:** NWS narrative forecast, the office's Fire Weather Forecast (FWF) discussion and zone text, and a 72-hour hourly table with CSV export.
*   **Burn Windows:** Heatmap of burn quality by hour. Hovering a cell shows its values and which prescription thresholds it misses. Daytime (10 AM–4 PM) windows of 2+ hours that meet the prescription are listed.
*   **Air Quality:** Current AQI and today/tomorrow AQI forecasts from EPA AirNow, and a map of Mississippi PM2.5 and ozone monitors. In Mississippi these forecasts and monitors are MDEQ's, reported through AirNow. Burn advice is shown when AQI exceeds 100 or 150.
*   **Fire & Smoke:** NOAA Hazard Mapping System (HMS) satellite fire detections and analyst-drawn smoke polygons, by region and date.
*   **Permits:** MFC burn permit records: summary and year-over-year statistics, maps of dispersion quality, permit density and smoke direction, charts by county and permit type, and a sortable table with date filters. Today's permits are enriched with the current NWS forecast for their county.
*   **Drought:** Latest U.S. Drought Monitor map.
*   **Safety:** A go/no-go checklist (saved in the browser), burn guidelines, an index reference and links to external resources.

### 4. Printable Burn Plan
*   One-page summary of the location, nearest station, current forecast hour, prescription criteria and a 12-hour hourly outlook, with space for notes.
*   Safety section at the top: every active NWS alert (critical fire weather alerts highlighted), a warning when alerts could not be checked, and the county burn ban status.

## 🔗 Quick Access

The dashboard is fully hosted and ready for use at:  
**[https://mississippi-prescribed-fire-dashboa.vercel.app/](https://mississippi-prescribed-fire-dashboa.vercel.app/)**

No installation or technical setup is required for end users. Simply open the link in any modern web browser.

## 🛠 Technical Stack (For Developers)

*   **Framework:** [Next.js 16+](https://nextjs.org/) (React 19) with Turbopack
*   **Mapping:** Leaflet & React-Leaflet on keyless Esri basemaps (Powered by Esri), leaflet.heat for permit density, shpjs to read the HMS and Drought Monitor shapefiles
*   **Charts:** Recharts (burn quality, weather trends, permit statistics)
*   **Other:** Tailwind CSS with Radix UI components, Framer Motion, Vercel Analytics, Vitest for unit tests
*   **Data Sources:** NWS API, EPA AirNow, NOAA HMS, U.S. Drought Monitor, MFC (burn permits and county burn bans), Iowa Environmental Mesonet (station observations), RCC-ACIS (PRISM grids for KBDI), OpenStreetMap Nominatim (place search).

To run it locally: `npm install`, put `AIRNOW_API_KEY` (and optionally `NWS_USER_AGENT`, the User-Agent sent to NWS and Nominatim) in `.env.local`, then `npm run dev`. `npm test` runs the unit tests.

### Fire Science Foundations

The core indices come from published, citable methods:

*   **Atmospheric Dispersion Index (ADI):** Implementation of Lavdas (1986), USDA Forest Service Research Paper SE-256, including Turner (1964) stability classification from solar elevation, cloud cover and wind. Unit tests check it against 25 of the published test cases in Table 5 of the paper.
*   **LVORI:** Low Visibility Occurrence Risk Index (Lavdas & Achtemeier 1995) for nighttime smoke/fog road hazards, with operational thresholds from USDA GTR SRS-103.
*   **KBDI:** Keetch-Byram Drought Index (Keetch & Byram 1968, Alexander 1990 correction) computed daily from observed NOAA/PRISM rainfall and temperature (RCC-ACIS). Mean annual rainfall is taken from the last 365 days of observations.
*   **Fosberg Fire Weather Index** (Fosberg 1978) for instantaneous fire-weather severity.
*   **1-hour fuel moisture:** Simard (1968) equilibrium moisture content, with ignition alerts keyed to southern Rx guide fine-fuel thresholds.
*   **Ventilation Index** categories per the Southern Forestry Smoke Management Guidebook.

These are simpler estimates, not published models: 10- and 100-hour fuel moisture (EMC adjusted by the days-since-rain setting), ignition probability (scaled from 1-hour fuel moisture), and the 0–100 burn quality score.

### County Burn Bans

**Source.** MFC posts its [burn ban map](https://www.mfc.ms.gov/burning-info/burn-bans/) as an image, but the same data drives MFC's Survey123 burn permit application and is public on MFC's ArcGIS organization:

*   [MFC Burn Permits County Boundaries](https://services5.arcgis.com/hE6urTTXj32LRUqx/arcgis/rest/services/MFC_Burn_Permits_County_Boundaries/FeatureServer/0): one polygon per county with `hasCountyBan` / `hasMFCBan`. This is the ban list and the map outlines. The layer's `dataLastEditDate` is the "as of" time (MFC's notebook refreshes it hourly).
*   [ms_counties_burn_ban_info.csv](https://www.arcgis.com/home/item.html?id=e909364200594201a846c2f46326313a): which numbered exemptions from MFC's exemption key each county's order lists (1 MFC, 2 Certified Burn Managers, 3 County Fire Services, 4 Commercial contractors, 5 Agricultural field burn). Exemption 6, "Other", is not in the feed.

Both are county-level only. The app does not touch the permit layer for bans, and requests only county name and ban flags.

**When a ban vetoes the burn.** Under [Miss. Code § 49-19-351](https://law.justia.com/codes/mississippi/title-49/chapter-19/restrictions-on-outdoor-burning/section-49-19-351/), a county Board of Supervisors may "prohibit or restrict" outdoor burning once MFC finds drought or wildfire conditions. Violation is a misdemeanor ($100–$500). Neither that section nor the Prescribed Burning Act (§ 49-19-301 et seq.) exempts prescribed burning; each order lists its own exemptions. So for the selected county:

*   **Ban whose order lists exemption 2 (Certified Burn Managers):** a prominent warning, not a veto. A certified prescribed burn manager may burn under an MFC burn permit; all other burning is prohibited.
*   **Ban whose order does not list exemption 2, or an MFC ban:** RESTRICTED veto, the same as a Red Flag Warning.
*   **Ban whose exemptions could not be read:** a warning that the exemption status is unknown.

**Failing visibly.** If the MFC county layer cannot be reached, is incomplete (not all 82 counties) or is malformed, the dashboard says "Burn ban status unavailable" and the status card never shows green. It never shows "no bans" in that case. The same applies when the county lookup for the selected point fails, or when MFC's data is more than a day old and the county shows no ban.

**Not covered.** Statewide or partial-state bans proclaimed by the Governor (e.g. 2023, with no exemptions) are published as press releases. The feed may not reflect them, so check mfc.ms.gov during statewide drought. Ban expiry dates are on the MFC order, not in the feed. The NWS Fire Weather Notification (FWN) check is kept as a secondary notice, but Mississippi's offices (JAN, MEG, MOB, LIX) issue none at present.

### Data Integrity & Security

*   **Unit-aware NWS conversions:** All grid values (transport wind, mixing height, temperature) are converted using the unit-of-measure (`uom`) declared by the NWS API rather than hardcoded assumptions, so the Ventilation Index and dispersion categories match official data exactly.
*   **Timestamp-aligned forecasts:** NWS time series are joined by timestamp (not array index), correctly handling multi-hour and multi-day duration encodings. Short gaps at the end of the grid carry the last known value forward.
*   **Location-correct dispersion modeling:** Atmospheric stability uses the sun's elevation at the forecast location and hour.
*   **Hardened API layer:** All API routes validate coordinates, station IDs, dates, and payload sizes; security headers (Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy) are applied site-wide. The browser fetches data only from this site (`connect-src 'self'`); upstream services, MFC's ArcGIS burn ban data included, are called from the server routes, so they need no CSP entry. Map tiles (Esri), Leaflet's stylesheet (unpkg) and Vercel Analytics are the only third-party assets the page loads.

## 📄 Disclaimer
This dashboard is a decision-support tool only. All burn decisions must be made by qualified prescribed fire managers using current field conditions. Always verify conditions on-site before ignition.

---
*Developed by Rodney Cuevas, RCuevas@mdeq.ms.gov for the Mississippi Department of Environmental Quality (MDEQ)*
