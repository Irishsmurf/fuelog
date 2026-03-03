# Fuelog Architecture

## Overview
**Fuelog** is a single-page application (SPA) that uses a serverless architecture with **Firebase** and **React**. It is built with **Vite** and **TypeScript**.

## Frontend Layers

### 1. View Layer (React + Tailwind CSS)
- **Framework:** React 19.
- **Styling:** Tailwind CSS 4 for a responsive, utility-first design.
- **Components:** Modular structure with generic and page-specific components.
- **Pages:** Feature-oriented page components in `src/pages/`.

### 2. State Management (React Context API)
- **AuthContext:** Manages Firebase User object, loading state, and auth methods.
- **ThemeContext:** Handles dark/light mode toggle and system preference detection.

### 3. Service Layer (Firebase)
- **Firestore:** Direct interactions with Firestore via `firebase/firestore`.
- **Authentication:** Managed via `firebase/auth` with Google provider.
- **Remote Config:** Fetches app-wide configuration (feature flags, etc.) via `firebase/remote-config`.

### 4. Utilities & Calculations
- **src/utils/calculations.ts:** Pure functions for fuel efficiency conversion.
    - MPG (UK) = (Distance Km * (1/1.60934)) / (Fuel L / 4.54609)
    - km/L = Distance Km / Fuel L
    - L/100km = (Fuel L / Distance Km) * 100
- **src/utils/types.ts:** Shared interfaces ensuring type safety across the app.

## Backend (Firebase)

### Firestore Structure
- **Collection:** `fuelLogs`
    - `id`: Unique document ID.
    - `userId`: Reference to Firebase Auth UID.
    - `timestamp`: Firestore Timestamp.
    - `brand`: Filling station brand.
    - `cost`: Total cost (€).
    - `distanceKm`: Distance covered (Km).
    - `fuelAmountLiters`: Litres added.
    - `latitude`: Geolocation (optional).
    - `longitude`: Geolocation (optional).
    - `locationAccuracy`: Geolocation (optional).

### Offline Support
- Firestore persistence is enabled via `persistentLocalCache` with `persistentSingleTabManager`.
- This allows users to log fuel entries without an internet connection, syncing once online.

## Deployment
- **Platform:** Vercel.
- **Analytics:** Integration with `@vercel/analytics`.
- **CI/CD:** Automatic deployment via GitHub actions/Vercel integration.
