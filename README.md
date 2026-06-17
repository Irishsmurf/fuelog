<div align="center">
  <img src="docs/assets/header.jpg" alt="Fuelog Header" width="100%" />

  <br />
  <br />

  <h1>fuelog</h1>

  <p>
    <strong>Track every fill-up. Understand your vehicle. Reduce your costs.</strong>
  </p>

  <p>
    <a href="https://github.com/Irishsmurf/fuelog/actions/workflows/main-ci.yml"><img src="https://github.com/Irishsmurf/fuelog/actions/workflows/main-ci.yml/badge.svg" alt="CI"></a>
    <a href="https://codecov.io/gh/Irishsmurf/fuelog"><img src="https://codecov.io/gh/Irishsmurf/fuelog/branch/main/graph/badge.svg" alt="codecov"></a>
    <a href="https://github.com/Irishsmurf/fuelog/actions/workflows/i18n-check.yml"><img src="https://github.com/Irishsmurf/fuelog/actions/workflows/i18n-check.yml/badge.svg" alt="i18n"></a>
  </p>

  <p>
    <a href="https://fuelog.paddez.com">View Demo</a>
    ·
    <a href="https://github.com/Irishsmurf/fuelog/issues">Report Bug</a>
    ·
    <a href="https://github.com/Irishsmurf/fuelog/issues">Request Feature</a>
  </p>
</div>

---

## 📖 About The Project

Fuelog is a mobile-first Progressive Web App designed for logging fuel fill-ups, tracking efficiency trends, and managing costs across multiple vehicles. With features like AI receipt scanning via Gemini, real-time geolocation, and multi-currency support, it transforms the chore of tracking fuel into a seamless, automated experience.

Whether you're managing a single daily driver or a small fleet, Fuelog provides the analytics you need to build a comprehensive picture of your fuel spend over time.

---

## ✨ Features

- **⚡ Frictionless Logging:** Log cost, litres, and distance in a single screen.
- **🧠 AI Receipt Scanning:** Snap a photo of your receipt and Gemini extracts the data automatically.
- **📍 Geolocation:** Captures the fill-up position for map and station tracking.
- **🚗 Multi-Vehicle Support:** Manage unlimited vehicles (make, model, year, fuel type).
- **💱 Multi-Currency:** Log fills in 30+ currencies with automatic exchange rates via Frankfurter API.
- **📊 Rich Analytics:** Efficiency metrics (km/L, L/100km, MPG), trend charts with Recharts, and lifetime totals.
- **🗺️ Station Tracking:** Track every filling station, view average prices, and see a cluster map of all locations.
- **🌍 Internationalisation:** Available in English, Irish (Gaeilge), German, Spanish, French, Finnish, Japanese, Korean, Norwegian, and Swedish.

---

## 🛠 Tech Stack

Built with modern web technologies:

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS v4
- **Backend / DB:** Firebase (Auth, Firestore, Storage, Remote Config, FCM)
- **AI Integration:** Google Gemini
- **Maps:** Leaflet, react-leaflet
- **Charts:** Recharts
- **Testing:** Vitest, Playwright

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

- Node.js (LTS)
- npm
- A Firebase project with Authentication (Google provider), Firestore, and Storage enabled.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Irishsmurf/fuelog.git
   cd fuelog
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy the example below into a `.env` file at the project root. Never commit this file to version control.
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
   VITE_GEMINI_MODEL=gemini-2.5-flash
   VITE_GEMINI_THINKING_BUDGET=512
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

Open `http://localhost:5173` to view it in your browser.

---

## 📚 Documentation

For deep-dives into the architecture, APIs, and integrations, explore our documentation:

- [Architecture](docs/ARCHITECTURE.md) - System design, Firestore schema, service layers
- [REST API](docs/REST_API.md) - API endpoints & authentication
- [MCP Server](docs/MCP.md) - Connect LLMs to your fuel data
- [Firebase Setup](docs/FIREBASE.md) - Firestore rules, Storage config, FCM setup
- [Gemini Integration](docs/GEMINI.md) - AI receipt extraction configuration
- [Features & Roadmap](docs/FEATURES.md) - Full reference and planned milestones
- [User Flows](docs/USER_FLOWS.md) - End-to-end user journey documentation

---

## 🎨 Branding & Design Guidelines

Fuelog's visual identity is built around the **petrol forecourt at night** — the amber glow of price boards and the industrial precision of pump readouts. 

- **Primary Colour:** Amber 600 (`#D97706`) / Amber 400 (`#FBBF24`)
- **Surface:** Petroleum (`#0A0F1E`) for dark mode, Near white (`#F9FAFB`) for light mode.
- **Typography:** Space Grotesk (Display), Inter (Body), Space Mono (Data).
- **Wordmark:** Lowercase `fuelog` set in Space Grotesk Bold, with a split tone (`#F59E0B` / `#374151`).

*Every design decision should serve legibility and functional confidence, not decoration. Numbers always use tabular-numeric mono rendering for clean, dashboard-like alignment.*

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

*Please ensure all PRs include tests, follow the commitlint conventional format, and pass the existing suite (`npm test`).*

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
