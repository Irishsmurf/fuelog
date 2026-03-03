# Fuelog Issue Tracking

## Bug: Table View Breaks Mobile Layout
**Description:** Switching to "Table View" on mobile causes the page width to exceed the viewport, making the `BottomNav` too wide and requiring horizontal scrolling.
**Status:** Completed
**Priority:** High

### Tasks:
- [x] Create issue for tracking.
- [x] Investigate `HistoryPage.tsx` table rendering.
- [x] Investigate `BottomNav.tsx` styling.
- [x] Implement fix (likely `overflow-x-auto` on the table container).
- [x] Verify fix on mobile viewport.

## Bug: PWA Maskable Icons not dynamic
**Description:** `icon-512x512.png` and other icons were not marked as maskable in the manifest, causing them to not render dynamically as PWA icons.
**Status:** Completed
**Priority:** Medium

### Tasks:
- [x] Update `vite.config.ts` to include all maskable icon sizes.
- [x] Set `purpose: "any maskable"` for main icons and `purpose: "maskable"` for dedicated maskable icons.
- [x] Verify manifest generation via `npm run build`.
