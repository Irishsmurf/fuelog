# Feature: Petrol Station Association & Clustering

## Overview
The Petrol Station Association & Clustering feature enhances the location-based logging capabilities of Fuelog. Instead of merely storing raw GPS coordinates, the application now identifies the specific petrol station where a fueling event occurred using **OpenStreetMap (OSM)** data.

### Key Benefits
- **Logical Clustering**: Logs are grouped by physical station on the map rather than simple visual proximity.
- **Price Analytics**: Track average prices paid at specific stations to identify the most cost-effective fueling locations.
- **Auto-Fill**: Automatically identifies the station brand/name during logging based on your location.
- **Station History**: View all fueling events associated with a specific station in one place.

## How It Works

### 1. Station Identification
When you log a fuel entry with location permission granted:
1. The app captures your current **GPS coordinates**.
2. A request is sent to the **Overpass API** (OpenStreetMap) to find the nearest `amenity=fuel` within a 150-meter radius.
3. If a station is found, its unique **OSM ID** is used to link the log to a `Station` document in Firestore.
4. If the station hasn't been visited by any user before, a new global `Station` entry is created.

### 2. Data Model
- **Logs**: Now contain a `stationId` field which references a document in the `stations` collection.
- **Stations**: Store metadata including `name`, `brand`, `latitude`, `longitude`, `address`, `avgPrice`, and `logCount`.

### 3. Clustering & Visualization
- **Map View**: The `FuelMapPage` fetches both logs and their associated stations. It groups logs by `stationId`.
- **Popups**: Clicking a station marker on the map displays:
    - The Station Name.
    - Your **Average Price Paid** at that station.
    - A scrollable list of recent fuelings at that specific location.

## Configuration & Setup

### Overpass API
The feature uses the public Overpass API instance: `https://overpass-api.de/api/interpreter`. 
No API key is required for standard usage, but the application implements a 1-second delay during batch migrations to respect rate limits.

### Firestore Rules
Ensure your Firestore rules allow access to the `stations` collection:
```javascript
match /stations/{stationId} {
  allow read: if request.auth != null;
  allow create, update: if request.auth != null;
}
```

### Remote Config
(Optional) While not currently gated, the feature relies on location permission. Ensure `navigator.geolocation` is available and permissions are requested in your environment.

## Historical Data Migration
Logs with coordinates but no `stationId` are linked server-side: the `onLogWrite`
Cloud Function looks up the nearest station when a log is written, and the
hand-run `derivedLogFields_v1` backfill does the same for historical logs (see
`scripts/README.md`).

## Technical Details
- **Service**: `src/utils/locationService.ts` handles the OSM/Overpass logic.
- **Server**: `functions/src/logDerived.ts` (trigger) and `functions/src/derivedLogFieldsMigration.ts` (backfill); the query and nearest-station choice are shared from `packages/core/src/overpass.ts`.
- **UI Components**: Updated `QuickLogPage.tsx`, `FuelMapPage.tsx`, `HistoryPage.tsx`, and `LogCard.tsx`.
