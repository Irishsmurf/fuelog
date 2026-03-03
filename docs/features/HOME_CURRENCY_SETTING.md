# Feature Plan: Default/Home Currency Setting

## Overview
Currently, the application defaults to **EUR** for all new logs and summary calculations. This feature will allow users to define their own **Home Currency** (e.g., GBP, USD, PLN), which will serve as the default selection for new logs and the primary currency for all history and analytics views.

## User Requirements
- Select a preferred **Home Currency** in the Profile/Settings page.
- New fuel logs should automatically default to this currency on the Quick Log page.
- All summary metrics (Total Spent, Average Cost) and charts should reflect the Home Currency.
- Exchange rates should automatically convert transaction amounts to the Home Currency if they differ.

## Proposed Changes

### 1. Data Model Update
**Firestore Collection: `userProfiles`**
- `userId`: string (Document ID)
- `homeCurrency`: string (e.g., "GBP")
- `updatedAt`: Timestamp

### 2. User Context / State Management
- Extend `AuthContext` or create a `UserPreferencesContext` to fetch the user's profile data upon authentication.
- Provide `homeCurrency` globally to the application.

### 3. UI: Profile Page Upgrades
- Add a "Preferences" or "General Settings" section to `src/pages/ProfilePage.tsx`.
- Include a dropdown using `COMMON_CURRENCIES` from `currencyApi.ts`.
- Save the selection to the `userProfiles` collection.

### 4. UI: Quick Log Integration
- Update `src/pages/QuickLogPage.tsx` to initialize the `currency` state from the user's `homeCurrency` instead of the hardcoded "EUR".

### 5. Analytics & History Integration
- Ensure `HistoryPage.tsx` summary calculations use the user's selected Home Currency symbol.
- (Optional) If the user changes their Home Currency, the app should dynamically recalculate summary metrics based on stored conversion data or current rates.

## Implementation Strategy
1.  **Profile Storage:** Implement the Firestore write logic for `userProfiles`.
2.  **Global Loading:** Add a hook to fetch the profile on app load.
3.  **UI Settings:** Add the currency picker to the Profile page.
4.  **Logging Default:** Connect the Quick Log currency picker to the user's preference.

## Future Considerations
- Support for changing the "Base" currency of historical data.
- Multi-language support based on the same profile settings.
