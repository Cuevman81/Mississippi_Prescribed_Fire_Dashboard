# Mississippi Prescribed Fire Weather Dashboard

[![View Live Dashboard](https://img.shields.io/badge/🚀-View%20Live%20Dashboard-orange?style=for-the-badge)](https://mississippi-prescribed-fire-dashboa.vercel.app/)

A comprehensive web-based decision support tool for prescribed fire managers, providing real-time weather, air quality, and fire behavior indices.

## 🚀 Key Features

### 1. Real-Time Operational Dashboard
*   **Burn Status Summary:** Instant "Within/Outside Prescription" status with specific reasons for sub-optimal conditions.
*   **Interactive Location Map:** Click-to-set location functionality to get pinpoint forecasts for any burn unit.
*   **Current Conditions:** Real-time data from the nearest ASOS/AWOS weather stations integrated with NWS high-resolution grid forecasts.

### 2. Decision Support Tools
*   **Prescription (Rx) Presets:** Rapidly toggle between common fuel scenarios (Grassland, Pine Understory, Site Prep) or define custom thresholds.
*   **Burn Quality Heatmap:** 72-hour outlook with "Why" indicators explaining precisely why specific hours are sub-optimal (e.g., Low VI, High RH).
*   **Smoke Dispersion Analysis:** Visualization of ventilation index (VI), mixing heights, and transport winds.

### 3. Comprehensive Environmental Data
*   **Air Quality (AQI):** Real-time monitoring from EPA AirNow and Mississippi MDEQ stations.
*   **Fire & Smoke Mapping:** NOAA Hazard Mapping System (HMS) satellite detections and analyst-drawn smoke polygons.
*   **Burn Permits:** Active Mississippi Forestry Commission (MFC) permit visualization with live weather enrichment.
*   **Drought Monitor:** Latest U.S. Drought Monitor data for long-term fuel moisture context.

### 4. Field Readiness
*   **Printable Burn Plan:** Generate a clean, one-page operational summary containing current forecasts, prescription criteria, and 12-hour outlooks designed for field use.

## 🛠 Technical Stack

*   **Framework:** [Next.js 15+](https://nextjs.org/) (React 19)
*   **Styling:** Tailwind CSS with Material Design principles
*   **Mapping:** Leaflet & React-Leaflet
*   **Charts:** Recharts
*   **Data Sources:** 
    *   National Weather Service (NWS) API
    *   EPA AirNow API
    *   NOAA Hazard Mapping System
    *   U.S. Drought Monitor
    *   Mississippi Forestry Commission

## 🏁 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/Cuevman81/Mississippi_Prescribed_Fire_Dashboard.git

# Install dependencies
npm install
```

### Running Locally

```bash
# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📄 Disclaimer
This dashboard is a decision-support tool only. All burn decisions must be made by qualified prescribed fire managers using current field conditions. Always verify conditions on-site before ignition.

---
*Developed for the Mississippi Department of Environmental Quality (MDEQ)*
