import L from 'leaflet';

declare global {
  interface Window {
    L: typeof L;
  }
}

// Leaflet plugins like leaflet.heat and leaflet.markercluster expect L to be globally available on the window object.
// In production bundles, tree-shaking and module scoping can hide L, causing "L is not defined" errors.
// We explicitly attach it here before any map components are loaded.

if (typeof window !== 'undefined') {
  window.L = window.L || L;
}
