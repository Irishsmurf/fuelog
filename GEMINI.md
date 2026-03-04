# Fuel Logger (fuelog) - Project Context

## Project Overview
**Fuel Logger** is a mobile-first React web application built with **Vite**, **TypeScript**, and **Firebase**. It is designed to track vehicle fuel consumption, costs, and efficiency metrics, replacing manual spreadsheet logging.

### Key Technologies
- **Frontend:** React 19, TypeScript, Vite.
- **Styling:** Tailwind CSS 4 (using `@tailwindcss/vite` plugin).
- **Backend:** Firebase (Authentication, Firestore with offline persistence, Remote Config).
- **Routing:** React Router DOM (v7).
- **Charts:** Recharts for visualizing efficiency metrics (MPG) over time.
- **Maps:** Leaflet & React Leaflet for fuel station location visualization (heatmap/clusters).
- **Testing:** Vitest (unit/component), Playwright (E2E).
- **Deployment:** Vercel (with Analytics integration).

### Core Features
- **Google Authentication:** Secure sign-in via Firebase.
- **Fuel Logging:** Log cost, distance, and fuel amount; automatically captures geolocation.
- **Efficiency Metrics:** Calculates km/L, L/100km, MPG (UK), and Cost per Mile.
- **Data Visualization:** Trends chart and interactive map of filling stations.
- **Data Import:** Support for importing historical data from TSV files.
- **Dark Mode:** System-aware theme toggle supported via `ThemeContext`.

---

## Building and Running

### Development
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Environment Variables:**
    Create a `.env` file in the root with the following (prefix with `VITE_`):
    - `VITE_FIREBASE_API_KEY`
    - `VITE_FIREBASE_AUTH_DOMAIN`
    - `VITE_FIREBASE_PROJECT_ID`
    - `VITE_FIREBASE_STORAGE_BUCKET`
    - `VITE_FIREBASE_MESSAGING_SENDER_ID`
    - `VITE_FIREBASE_APP_ID`
3.  **Start Dev Server:**
    ```bash
    npm run dev
    ```

### Production
- **Build:** `npm run build` (runs `tsc` and `vite build`)
- **Preview Build:** `npm run preview`

### Testing & Linting
- **Unit/Component Tests:** `npm run test` (Vitest)
- **E2E Tests:** `npm run test:e2e` (Playwright)
- **Linting:** `npm run lint` (ESLint)

---

## Development Conventions

### General Mandates
- **Unit Testing:** ALWAYS add unit tests for all new code. Ensure that your changes are verified before completion.
- **Feature Gating:** ALWAYS gate new features behind a **Remote Config** flag. Refer to `docs/playbooks/FEATURE_RELEASING.md` for the standard procedure.

### Architecture
- **Functional Components:** All components are written as functional components using TypeScript.
- **Context API:** Global state (Auth, Theme) is managed via React Context providers in `src/context/`.
- **Service Layer:** Firebase logic is centralized in `src/firebase/`. Firestore interactions use `db` with offline persistence enabled.
- **Type Safety:** Shared types and interfaces are defined in `src/utils/types.ts`.

### Styling
- **Tailwind CSS 4:** Styling is strictly done via Tailwind CSS classes. Custom global styles are in `src/index.css`.
- **Responsive Design:** Mobile-first approach using Tailwind's responsive modifiers (`sm:`, `lg:`, etc.).

### Testing Standards
- **Unit Tests:** Located alongside components (`*.test.tsx`) or in `src/utils/*.test.ts`. Use `@testing-library/react`.
- **E2E Tests:** Located in `e2e/`. Use Playwright.

### Data Model (`src/utils/types.ts`)
- **`FuelLogData`**: The core data structure for fuel entries.
- **`Log`**: Extends `FuelLogData` with a Firestore document `id`.
- **`Timestamp`**: Uses Firestore's `Timestamp` for dates.

---

## Key Files Summary
- `src/main.tsx`: App entry point, Remote Config initialization.
- `src/App.tsx`: Root component with Context Providers and Router.
- `src/firebase/config.ts`: Firebase initialization and auth functions.
- `src/components/AuthenticatedApp.tsx`: Main layout and routing for logged-in users.
- `src/utils/calculations.ts`: Logic for efficiency metrics.
- `src/utils/types.ts`: TypeScript interfaces for the entire project.
- `playwright.config.ts`: Configuration for E2E testing.
- `vite.config.ts`: Vite config with Tailwind and Vitest integration.
