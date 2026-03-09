# Fuelog Roadmap (2026 Update)

This document outlines the current status of features and the strategic direction for the **Fuelog** application.

## 🏁 Completed Objectives (Status Check)

### Core & UX
- [x] **Multi-Vehicle Support:** Manage multiple cars/rentals under one account.
- [x] **PWA Implementation:** Fully installable mobile experience with offline persistence.
- [x] **Internationalization (i18n):** Support for 10 languages (EN, GA, ES, FR, DE, JA, KO, SV, NO, FI).
- [x] **Multi-Currency:** Automatic exchange rate conversion via Frankfurter API.
- [x] **Build Optimization:** Advanced bundle splitting and lazy loading for high performance.

### Data & Visualization
- [x] **PDF Export:** Professional fuel history reports.
- [x] **Map Intelligence:** Heatmaps and marker clustering for filling stations.
- [x] **TSV Import:** Bulk data ingestion from legacy spreadsheets.
- [x] **MCP Integration:** Model Context Protocol support for LLM-driven data analysis.

---

## 🚀 Phase 1: Precision & Maintenance (Q2 2026)
*Focus on vehicle health and refining the logging experience.*

- [ ] **Comprehensive Maintenance Tracker:**
    - Log service events (Oil changes, Tire rotations, Brake service).
    - Attach receipt photos specifically to maintenance events.
    - Set distance-based reminders (e.g., "Remind me in 10,000km for oil").
- [ ] **Advanced Dashboard Widgets:**
    - "Efficiency Anomaly Detection": Alerts if recent MPG drops significantly below average.
    - "Fuel Spend Forecast": Predict monthly spend based on historical trends.
- [ ] **Station Brand Auto-Suggest Enhancement:**
    - Group similar station names (e.g., "Circle K" vs "Circle-K") using fuzzy matching.
- [ ] **Dark Mode Refinement:**
    - More granular control over theme (Follow System vs Manual Toggle).

## 🧠 Phase 2: Intelligence & AI (Q3 2026)
*Leveraging Gemini and advanced logic for automation.*

- [ ] **Receipt AI v2 (Vision):**
    - Improve Gemini-based OCR accuracy for complex thermal receipts.
    - Auto-detect station location from the receipt text if GPS is missing.
- [ ] **Predictive Fuel stops:**
    - Suggest the best time to refuel based on current tank level (calculated) and expected mileage.
- [ ] **Smart Regional Insights:**
    - Compare your efficiency with aggregated anonymous data from other users with the same vehicle model.
- [ ] **Voice Logging:**
    - "Hey Fuelog, I just spent 50 Euro at Shell for 35 Litres" - hands-free entry.

## 🌐 Phase 3: Ecosystem & Expansion (Q4 2026+)
*Broadening the reach and integration capabilities.*

- [ ] **Capacitor/Native Port:**
    - Package the PWA into a native Android/iOS app for better system-level integration (notifications, background tasks).
- [ ] **External Price APIs:**
    - Integrate with real-time fuel price providers to show "Cheapest Nearby" stations on the map.
- [ ] **Team/Shared Vehicles:**
    - Allow multiple users to log data for a shared vehicle (e.g., family car or small business fleet).
- [ ] **OBD-II Integration (Research):**
    - Explore reading data directly from the vehicle via Bluetooth OBD-II scanners.

---

*Note: This roadmap is a living document. Priorities are adjusted based on user feedback and technological advancements.*
