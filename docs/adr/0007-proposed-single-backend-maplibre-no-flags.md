# 7. Single backend on Firebase Functions, MapLibre-only maps, no Remote Config flags

Status: proposed (not started)

## Context

- The backend is split. REST, MCP and receipt extraction run as Vercel
  functions (`api/`), while triggers and schedules run as Firebase Functions
  (`functions/`). Server SDKs sit in the SPA's package manifest.
- Maps use Leaflet, react-leaflet, leaflet.heat, a markercluster release
  candidate and a Leaflet-to-MapLibre bridge. The `window.L` and worker-URL
  workarounds caused several production incidents.
- Remote Config gates core features (for example `odometerInputEnabled`), and
  the app shell waits for it before rendering (with a 5 s fetch timeout).

## Decision (proposed)

1. Move REST, MCP and receipt extraction to Firebase Functions v2 in
   `europe-west1`, with the Gemini key in Secret Manager. This gives one Admin
   SDK version, one region and one deploy pipeline, and removes server SDKs
   from the SPA package.
2. Use MapLibre GL only (`react-map-gl/maplibre`) with its built-in clustering
   and heatmap layers, and drop the Leaflet stack.
3. Remove the Remote Config flags. Flagged core features become standard; any
   flag still needed moves to a small typed static config.

## Consequences

- REST and MCP URLs and CORS change, so clients and docs need updating.
- Server code can import `@fuelog/core` as a package instead of by relative path.
- SPA hosting (Vercel or Firebase Hosting) is still an open decision.
