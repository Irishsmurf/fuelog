# Feature Plan: Mobile UX Revamp

## Overview
Shift Fuelog from "Responsive Desktop" to "Mobile-First Native Feel". This involves restructuring the layout and refining interactions to suit one-handed mobile use.

## Proposed Changes

### 1. Performance Optimization (High Impact)
- **Route-based Code Splitting:** Use `React.lazy` and `Suspense` to split the bundle by page. Initial load should only include `Login` or `QuickLogPage`. `HistoryPage`, `FuelMapPage`, `ImportPage`, and `ProfilePage` will be loaded on demand.
- **Estimated Savings:** Up to 70% reduction in initial JavaScript payload.

### 2. New Layout Component (`src/components/MobileLayout.tsx`)
- **Bottom Navigation:** A fixed bottom bar with icons for:
    - **Log** (Home)
    - **History**
    - **Map**
    - **Profile**
- **Adaptive Header:** A simplified top bar that only shows the app title and Theme/Logout if not in the bottom bar.

### 2. Quick Log Enhancements
- Use `inputMode="decimal"` consistently to ensure the correct keyboard.
- Group "Cost & Currency" and "Vehicle & Brand" into distinct visual sections.
- Add "Recent Garage" quick-select chips to avoid typing.

### 3. History Page Optimization
- Default to **Card View** on screens `< 768px`.
- Implement a "Summary Dashboard" at the top of History that is swipeable (carousel) on mobile.
- Make cards interactive: Tap to see full details (Original currency, location accuracy, etc.).

### 4. Gestures & Feedback
- Add subtle haptic vibration on successful log (using `window.navigator.vibrate`).
- Add active states to all buttons to provide immediate visual feedback on touch.

## Implementation Steps

### Phase 1: Navigation
1.  Create `src/components/BottomNav.tsx`.
2.  Modify `AuthenticatedApp.tsx` to conditionally render Top vs Bottom nav based on screen size (or just use both strategically).
3.  Add `lucide-react` or similar for mobile-optimized icons.

### Phase 2: Form & Cards
1.  Refactor `QuickLogPage.tsx` form layout for better vertical spacing.
2.  Update `LogCard.tsx` with a more modern, compact layout.

## Testing Strategy
- **Visual Regression:** Use Playwright to capture screenshots at `375x812` (iPhone X size).
- **Usability Test:** Verify that the bottom nav is always clickable and not obscured by the mobile browser's UI (handling `100vh` vs `100dvh`).
- **Touch Targets:** Verify all interactive elements are at least `44x44px`.
