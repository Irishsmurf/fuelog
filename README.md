# fuelog

**Track every fill-up. Understand your vehicle. Reduce your costs.**

[![CI](https://github.com/Irishsmurf/fuelog/actions/workflows/main-ci.yml/badge.svg)](https://github.com/Irishsmurf/fuelog/actions/workflows/main-ci.yml)
[![codecov](https://codecov.io/gh/Irishsmurf/fuelog/branch/main/graph/badge.svg)](https://codecov.io/gh/Irishsmurf/fuelog)
[![i18n](https://github.com/Irishsmurf/fuelog/actions/workflows/i18n-check.yml/badge.svg)](https://github.com/Irishsmurf/fuelog/actions/workflows/i18n-check.yml)

Fuelog is a mobile-first Progressive Web App for logging fuel fill-ups, tracking efficiency trends, and managing costs across multiple vehicles. Sign in with Google, log a fill in under 30 seconds, and build a picture of your fuel spend over time.

Live at **[fuelog.paddez.com](https://fuelog.paddez.com)**

---

## Features

### Fuel Logging
- Log cost, litres, and distance in a single screen
- **Odometer tracking** with smart distance calculation from the previous fill
- **AI receipt scanning** — photograph a receipt and Gemini extracts the data automatically
- **Geolocation** captures the fill-up position for map and station tracking
- Brand auto-suggest from your own history

### Multi-Vehicle & Multi-Currency
- Add unlimited vehicles (make, model, year, fuel type); archive old ones
- Set a home currency and log fills in any of 30+ currencies — exchange rates are fetched automatically via the Frankfurter API

### History & Analytics
- Filterable, sortable log with card and table views
- Efficiency metrics per fill: km/L, L/100km, MPG (UK), cost per mile
- MPG and price-per-litre trend charts (Recharts)
- Lifetime totals: total spend, total litres, total distance, fill count
- PDF export and clipboard (TSV) export

### Stations
- Track every filling station you have visited
- See average and last price per litre per station
- Cluster map of all fill-up locations (Leaflet)

### Developer & Power-User Features
- **REST API** — programmatic access to logs, vehicles, and analytics with scoped bearer tokens ([docs](docs/REST_API.md))
- **MCP server** — connect Claude or any MCP-compatible LLM directly to your fuel data ([docs](docs/MCP.md))
- **TSV import** for bulk-loading historical data
- FCM push notifications (opt-in)
- Firebase Remote Config feature flags for controlled rollouts

### Internationalisation
Available in English, Irish (Gaeilge), German, Spanish, French, Finnish, Japanese, Korean, Norwegian, and Swedish.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 |
| Backend / DB | Firebase (Auth, Firestore, Storage, Remote Config, FCM) |
| AI | Google Gemini (receipt extraction) |
| Maps | Leaflet, react-leaflet |
| Charts | Recharts |
| i18n | i18next, react-i18next |
| Hosting | Firebase Hosting / Vercel (API routes) |
| Testing | Vitest, Playwright |

---

## Getting Started

### Prerequisites

- Node.js (LTS) and npm
- A Firebase project with Authentication (Google provider), Firestore, and Storage enabled

### 1 — Clone and install

```bash
git clone https://github.com/Irishsmurf/fuelog.git
cd fuelog
npm install
```

### 2 — Configure environment variables

Copy the example below into a `.env` file at the project root. Never commit this file.

```env
# Firebase — required
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Google Gemini — optional, enables AI receipt scanning
VITE_GEMINI_API_KEY=

# Gemini model tuning — optional
VITE_GEMINI_MODEL=gemini-2.5-flash
VITE_GEMINI_THINKING_BUDGET=512
```

### 3 — Run

```bash
npm run dev
```

Open `http://localhost:5173`.

### Available scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Unit tests with coverage report |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run lint` | ESLint |

### Firestore security rules

Minimum rules for development — tighten before going to production:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fuelLogs/{logId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.userId;
    }
  }
}
```

Full rules including vehicles and stations are documented in [docs/FIREBASE.md](docs/FIREBASE.md).

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System design, Firestore schema, service layers |
| [Features](docs/FEATURES.md) | Full feature reference |
| [REST API](docs/REST_API.md) | API endpoints, authentication, request/response shapes |
| [MCP Server](docs/MCP.md) | Connecting LLMs to your fuel data |
| [Firebase Setup](docs/FIREBASE.md) | Firestore rules, Storage config, FCM setup |
| [Gemini Integration](docs/GEMINI.md) | AI receipt extraction configuration |
| [Roadmap](docs/ROADMAP.md) | Planned features and milestones |
| [User Flows](docs/USER_FLOWS.md) | End-to-end user journey documentation |

---

## Branding Guidelines

Fuelog's visual identity is built around the **petrol forecourt at night** — the amber glow of price boards, the industrial precision of pump readouts, the clarity required at a glance from a car window. Every design decision should serve legibility and functional confidence, not decoration.

### Colour

| Role | Name | Hex | Usage |
|---|---|---|---|
| Primary | Amber 600 | `#D97706` | Buttons, active states, links — light mode |
| Primary hover | Amber 700 | `#B45309` | Button hover in light mode |
| Primary glow | Amber 400 | `#FBBF24` | Accents and glows in dark mode |
| Success | Emerald 500 | `#10B981` | Positive feedback, full-tank states |
| Danger | Red 500 | `#EF4444` | Errors and destructive actions |
| Surface (dark) | Petroleum | `#0A0F1E` | Dark mode background — slightly blue-tinged black |
| Surface (light) | Near white | `#F9FAFB` | Light mode background |

**Amber is the brand colour.** It is derived from real-world petrol station LED price displays and grounds the product in its domain. Do not substitute it with indigo, violet, or other generic SaaS primaries.

**Button text is always dark on amber.** Both `#D97706` (light mode) and `#FBBF24` (dark mode) achieve WCAG AA contrast with `#111827` (gray-900). Never use white text on an amber background.

### Typography

| Role | Family | Weights | Usage |
|---|---|---|---|
| Display | Space Grotesk | 600, 700 | Wordmark, page headings, hero text |
| Body | Inter | 400, 500, 600 | Paragraphs, labels, UI copy |
| Data | Space Mono | 400, 700 | All numeric readouts — cost, litres, km, efficiency |

**Numbers always use Space Mono.** Fuel data is the primary content of this application. Tabular-numeric mono rendering keeps columns aligned and communicates precision — the same reason dashboards use dedicated display typefaces.

**The wordmark is set in Space Grotesk Bold.** `fuel` in Amber 500 (`#F59E0B`), `og` in Gray 700 (`#374151`) on dark backgrounds or Gray 400 (`#9CA3AF`) in the header. Letter-spacing is `-0.03em`. Do not use a heavier weight, do not apply text-transform, do not alter the two-tone split.

### Wordmark

```
fuelog
──────
fuel  → Amber 500  (#F59E0B)
og    → Gray 400/700 (context-dependent)
```

The wordmark is always lowercase. Uppercase or title-case variants are not permitted.

### Dark vs light mode

Fuelog supports both light and dark modes. The **sign-in screen is always dark** (`#0A0F1E`) regardless of system preference — it is a deliberate brand moment, not a UI mode.

Within the authenticated app, dark mode uses the petroleum surface (`#0A0F1E`) with amber-400 accents. Light mode uses a near-white surface with amber-600 as the primary.

### Iconography

Icons are sourced from **Lucide** at a stroke width of 1.75 (inactive) or 2.5 (active). Do not mix icon libraries. Icon size in navigation is 22px; in buttons and inline contexts, 16–18px.

### Motion

Interactions use a single easing curve: `cubic-bezier(0.4, 0, 0.2, 1)` (Material ease-in-out). Active press feedback uses `scale(0.96–0.98)`. Page load sequences use staggered fade/translate-up at 150ms intervals. Respect `prefers-reduced-motion` — all animations are suppressed when the user preference is set.

### Voice and copy

Fuelog speaks to drivers, not dashboards. Copy is short, direct, and metric-first. Prefer active verbs: "Log a fill-up", "View your history", "Export to PDF". Use sentence case everywhere. Avoid marketing language — the data is the story.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes. All PRs should include tests for new behaviour and pass the existing test suite (`npm test`).

## License

MIT
