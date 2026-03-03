# Feature Plan: PWA (Progressive Web App) Implementation

## Overview
Transform Fuelog into a full Progressive Web App to provide an app-like experience on mobile devices, including offline access to static assets and an "Install" prompt.

## User Requirements
- **Offline Capability:** The app should load even when there is no internet connection (cached assets).
- **Installable:** Users should be prompted to install the app on their home screen (mobile/desktop).
- **App-like UI:** Proper icons, theme colors, and standalone display mode.

## Proposed Changes

### 1. New Dependencies
- **`vite-plugin-pwa`**: To automate service worker generation and manifest handling within the Vite build process.

### 2. Vite Configuration (`vite.config.ts`)
- Integrate `VitePWA` plugin.
- Configure `registerType: 'autoUpdate'`.
- Define the manifest within the plugin config (or link to existing).
- Configure `workbox` for asset caching (styles, scripts, images, fonts).

### 3. Manifest Refinement (`public/manifest.json`)
- Correct the icon paths to match actual files in `public/`.
- Ensure `purpose: "maskable"` and `purpose: "any"` are correctly attributed.
- Add `shortcuts` if relevant (e.g., "Quick Log").

### 4. UI Implementation (`src/components/InstallPrompt.tsx`)
- Detect the `beforeinstallprompt` event.
- Show a custom, non-intrusive "Install Fuelog" banner or button (e.g., in the Profile page or as a floating snackbar).
- Handle the installation flow.

### 5. Service Worker Registration
- Ensure the service worker is registered in `main.tsx`.

## Testing Strategy

### Unit Tests
- Test the `InstallPrompt` component's visibility logic based on event state.

### E2E Tests (`e2e/pwa.spec.ts`)
- Verify that the manifest is correctly linked in the HTML head.
- Verify that the service worker is registered (using Playwright's ability to inspect service workers).
- Verify that the app is served with the correct `theme-color`.

### Manual Validation
- Use Chrome DevTools **Lighthouse** to audit the PWA status.
- Test "Add to Home Screen" on actual iOS and Android devices.
- Test offline mode by disabling network in DevTools.

## Implementation Steps
1.  [x] Install `vite-plugin-pwa`.
2.  [x] Configure `vite.config.ts` with PWA settings.
3.  [x] Fix and validate `manifest.json` and icons.
4.  [x] Implement `InstallPrompt` UI component.
5.  [x] Add PWA update logic (handled via `autoUpdate`).
6.  [x] Verify with Lighthouse and E2E tests.
