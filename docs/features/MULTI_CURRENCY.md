# Feature Plan: Multi-Currency Support

## Overview
Allows users to log fuel entries in various currencies (e.g., GBP, USD) while maintaining all historical analysis and charts in a single, consistent "Home Currency" (e.g., EUR).

## User Requirements
- Set a **Home Currency** in user preferences.
- Select a **Transaction Currency** when logging a fuel entry.
- **Automatic Exchange Rate Fetching:** Fetch the rate for the transaction date (defaults to today) using an external API.
- View history and charts consistently in the Home Currency.
- (Optional) View the original transaction currency/amount in the log details.

## Proposed Changes

### 1. Data Model (`src/utils/types.ts`)
Update `FuelLogData` to include currency information:
```typescript
interface FuelLogData {
    // ... existing fields
    currency: string;          // e.g., "GBP"
    originalCost: number;     // Amount in the transaction currency
    exchangeRate: number;      // Rate used to convert to Home Currency
    costHomeCurrency: number;  // The calculated cost in EUR (for charts/history)
}
```

### 2. User Preferences
- Create a `userProfile` collection in Firestore to store the `homeCurrency`.
- Add a settings section in the UI (perhaps on the `About` or a new `Settings` page).

### 3. Quick Log Page (`src/pages/QuickLogPage.tsx`)
- Add a dropdown to select the currency for the current entry (defaults to Home Currency).
- If Transaction Currency != Home Currency:
    - **API Integration:** Automatically fetch the rate for the selected date.
    - **Recommended API:** [Frankfurter API](https://www.frankfurter.app/) (Free, no API key for basic usage, supports historical rates).
    - Allow manual override of the fetched rate.
- Calculate `costHomeCurrency` before saving to Firestore.

### 4. History Page (`src/pages/HistoryPage.tsx`)
- Update the table and cards to display `costHomeCurrency`.
- Add a tooltip or small text to show the `originalCost` and `currency` if different from Home Currency.
- Ensure charts use `costHomeCurrency` for consistency.

### 5. Calculations (`src/utils/calculations.ts`)
- No changes needed to existing efficiency formulas, as they will use the normalized `costHomeCurrency`.

## Implementation Strategy
1.  **Schema Migration:** Update the code to handle both old logs (assumed to be in Home Currency) and new multi-currency logs.
2.  **API Utility:** Create a service in `src/utils/currencyApi.ts` to handle fetching from Frankfurter API.
3.  **UI Scaffolding:** Add the currency selector and "Fetching rate..." indicator to `QuickLogPage`.
4.  **Settings Page:** Implement a basic settings page to define the `homeCurrency`.
5.  **Conversion Logic:** Implement the math to convert and store the normalized cost.

## Future Considerations
- Support for Yahoo Finance via a proxy if more obscure currencies are needed.
- Multi-currency support for TSV imports.
