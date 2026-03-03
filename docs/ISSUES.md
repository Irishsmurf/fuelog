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

### Fix Summary:
1.  **`HistoryPage.tsx`**: Added `w-full` and `overflow-x-auto` to the table's container to ensure it scrolls horizontally instead of expanding its parent.
2.  **`AuthenticatedApp.tsx`**: Added `min-w-0` and `w-full` to the `<main>` flex item to prevent it from growing beyond the viewport width.
3.  **`AuthenticatedApp.tsx`**: Added `overflow-x-hidden` to the root layout div as a safeguard against horizontal scrolling on mobile.
