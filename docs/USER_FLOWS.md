# Fuelog User Flows

## 1. Authentication & Onboarding
- **Entry:** User arrives at the landing page.
- **Login:** User clicks "Sign in with Google".
- **Consent:** User authorizes via Google OAuth.
- **Redirect:** Upon success, user is redirected to the `/` (Quick Log) page.

## 2. Logging a Fuel Entry
- **Input:** User enters Brand (optional), Total Cost (€), Distance (Km), and Fuel (Litres).
- **Brand Suggestion:** As the user types the brand, the app suggests previously used brands from their history.
- **Submission:** User clicks "Save Fuel Log".
- **Geolocation:** The browser requests location permission (if not already granted). The app waits for a high-accuracy GPS fix (up to 10s).
- **Processing:** "Getting Location..." then "Saving..." indicators appear.
- **Success:** Form clears and a success message appears, noting if location was captured.

## 3. Viewing & Managing History
- **Navigation:** User clicks "History" in the navbar.
- **View Toggle:** User can switch between **Table View** (dense, sortable) and **Card View** (mobile-optimized).
- **Efficiency:** The app automatically calculates MPG, km/L, and L/100km for each entry.
- **Charts:** User scrolls down to see MPG trends and Price charts.
- **Export:** User clicks "Copy Table Data" to copy all logs to the clipboard in TSV format for use in Excel/Google Sheets.

## 4. Bulk Data Import
- **Navigation:** User clicks "Import".
- **Preparation:** User prepares a TSV file with columns: `Date`, `Litres`, `Total Cost`, `Garage`, `Distance since fueled [Km]`.
- **Action:** User pastes the TSV content into the text area and clicks "Process & Import Data".
- **Validation:** The app validates numeric fields and date formats.
- **Import:** Data is batch-written to Firestore.

## 5. Exploring the Fuel Map
- **Navigation:** User clicks "Map".
- **Visualization:** User sees markers for all logs that have geolocation data.
- **Interaction:**
    - **Clusters:** Zooming out clusters nearby markers.
    - **Heatmap:** Highlights areas with frequent fill-ups.
    - **Popups:** Clicking a marker shows the brand, date, and efficiency for that specific log.

## 6. Theme Customization
- **Toggle:** User clicks the Sun/Moon icon in the navbar.
- **Persistence:** The preference is saved in `localStorage` and applied immediately across all pages.
