# Mobile UX & Performance Audit Report

## Lighthouse Audit Summary (March 2026)
| Category | Score | Status |
| :--- | :--- | :--- |
| **Performance** | **56** | ⚠️ Needs Improvement |
| **Accessibility** | **94** | ✅ Excellent |
| **Best Practices** | **73** | ⚠️ Good |
| **SEO** | **91** | ✅ Excellent |

### Key Performance Bottlenecks
- **First Contentful Paint (FCP):** 5.1s
- **Largest Contentful Paint (LCP):** 6.6s
- **Unused JavaScript:** ~703 KiB potential savings. The main index bundle is significantly oversized (>550 KiB).
- **Execution Time:** High main-thread activity, likely due to heavy Firebase/Firestore initialization and large component trees being loaded upfront.

## Current State Analysis
Fuelog was built as a responsive web app, but it retains many desktop-centric patterns that hinder the mobile experience.

### 1. Navigation & Reachability
- **Issues:** The primary navigation is located at the top of the screen. On modern large smartphones (e.g., iPhone Pro Max, Pixel XL), this area is the hardest to reach during one-handed use.
- **Impact:** High cognitive load and physical strain for frequent navigation between "Log" and "History".

### 2. Information Density (Quick Log)
- **Issues:** The logging form is a vertical stack of inputs. While logical, it lacks visual grouping and can feel "long" on small screens.
- **Impact:** Users may need to scroll to reach the "Save" button depending on their screen height and keyboard presence.

### 3. Data Presentation (History)
- **Issues:** The app provides a toggle between Table and Card views. The Table view is practically unusable on mobile without horizontal scrolling. The Card view is better but lacks information hierarchy.
- **Impact:** Finding specific historical entries is slower than necessary.

### 4. Payload Size
- **Issues:** The application is serving a single large JavaScript bundle.
- **Impact:** Significant delay in time-to-interactive (TTI) on slower 4G/5G mobile connections.

## Recommended Upgrades

### Tier 1: Performance & Reachability (High Impact)
- **Code Splitting:** Implement `React.lazy` and `Suspense` to split the main bundle by route (e.g., Map and History should only load when needed).
- **Bottom Navigation Bar:** Move primary links (Log, History, Map, Profile) to a fixed bottom bar. This follows modern mobile design patterns (iOS/Android) and puts actions within the "Thumb Zone".
- **Floating Action Button (FAB):** Potentially use a FAB for the most common action: "Log New Fuel".

### Tier 2: Content Optimization
- **Refined History Cards:** Redesign cards to emphasize the most important data (Date, Efficiency, Cost) while hiding secondary details behind a "Tap to Expand" or "Slide for Details" pattern.
- **Input Grouping:** Use "Input Steppers" or better segmented controls for currency and vehicle selection to reduce typing.

### Tier 3: Visual Polish
- **Haptic Feedback:** Use the Vibration API for successful logs or errors.
- **Smooth Transitions:** Implement view transitions to make the app feel "native".
- **Pull-to-Refresh:** Implement a native-feeling pull-to-refresh for the History page.
