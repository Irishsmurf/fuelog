# Fuelog Features

## Authentication
- **Google Sign-In:** Secure authentication via Firebase Auth using Google accounts.
- **Session Management:** Persists login state across sessions.

## Quick Fuel Logging
- **Input Fields:** Capture Total Cost (€), Distance Covered (Km), and Fuel Added (Litres).
- **Brand Suggestion:** Auto-suggests filling station brands based on user history.
- **Geolocation:** Captures latitude, longitude, and accuracy upon logging (requires permission).
- **Validation:** Basic client-side validation for numeric inputs and non-empty fields.

## History & Analytics
- **Historical Table:** Sortable and filterable view of all past fuel logs.
- **Card View:** Mobile-optimized view of logs.
- **Efficiency Metrics:**
    - **MPG (UK):** Miles Per Gallon based on UK imperial gallons.
    - **km/L:** Kilometers per Litre.
    - **L/100km:** Litres per 100 Kilometers.
    - **Cost/Mile:** Total cost divided by miles covered.
- **Visualizations:**
    - **MPG Trends:** Line chart (Recharts) showing fuel efficiency over time.
    - **Price Chart:** Visualizes fuel price per litre over time.
- **Clipboard Export:** Button to copy table data to clipboard in TSV format.

## Fuel Map
- **Map View:** Interactive map (Leaflet) showing the locations of filling stations.
- **Clusters & Heatmaps:** Visualizes frequent filling locations using marker clustering and heatmaps.
- **Popups:** Clicking a marker shows log details (date, brand, cost, efficiency).

## Data Management
- **TSV Import:** Bulk import historical data from tab-separated files.
- **Firestore Backend:** Scalable NoSQL database with offline persistence support.

## User Interface
- **Responsive Design:** Mobile-first layout using Tailwind CSS.
- **Dark Mode:** System-preference-aware theme toggle.
- **PWA Ready:** Manifest and icons ready for Progressive Web App features.
