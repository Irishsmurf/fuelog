# Fuel Logger Web Application

## Description

A simple web application designed to track vehicle fuel consumption and costs, replacing manual spreadsheet logging. Initially built to monitor the usage of a 2013 VW Polo TSI, it allows users to quickly log fuel entries, view historical data, analyze trends through visualizations, and import existing data. The application captures location data during logging for potential future analysis like heatmaps.

Built with React, Vite, TypeScript, Firebase, and Tailwind CSS.

## Features

* **Authentication:** Secure sign-in using Google accounts via Firebase Authentication.
* **Quick Fuel Logging:**
    * Enter Total Cost (€), Distance Covered (Km), and Fuel Added (Litres).
    * Auto-suggests previously used Filling Station Brands to minimize typos.
    * Automatically captures Geolocation (Latitude, Longitude, Accuracy) on log submission (requires user permission).
* **History View:**
    * Displays all past fuel logs in a sortable, responsive table.
    * Calculates and displays efficiency metrics:
        * km/L (Kilometers per Litre)
        * L/100km (Litres per 100 Kilometers)
        * MPG (UK Miles Per Gallon)
        * Cost per Mile (€)
    * Includes a chart visualizing MPG (UK) over time.
    * "Copy Table Data" button to copy history to clipboard in TSV format.
* **Data Import:**
    * Import historical fuel data from TSV (Tab-Separated Value) files.
    * Maps relevant columns (Date, Litres, Total Cost, Garage, Distance since fueled [Km]) to the application's data structure.
    * Uses Firestore batch writes for efficient importing.
* **UI:** Clean, mobile-first interface styled with Tailwind CSS.

## Tech Stack

* **Frontend Framework:** React (with TypeScript)
* **Build Tool:** Vite
* **Styling:** Tailwind CSS
* **Backend & Database:** Firebase (Authentication, Firestore)
* **Charting:** Recharts
* **Language:** TypeScript

## Getting Started

### Prerequisites

* Node.js (LTS version recommended)
* npm (usually comes with Node.js)
* A Firebase project

### Setup

1.  **Clone the repository (replace with your actual repo URL):**
    ```bash
    git clone [https://github.com/your-username/fuel-logger.git](https://github.com/your-username/fuel-logger.git)
    cd fuel-logger
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Firebase:**
    * Go to the [Firebase Console](https://console.firebase.google.com/).
    * Create a new project (or use an existing one).
    * Enable **Authentication**: Add the **Google** sign-in provider. Make sure to add your app's authorized domain (usually `localhost` during development) in the settings.
    * Enable **Firestore Database**: Create a database (start in test mode for development, but configure security rules for production: `rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /fuelLogs/{logId} { allow read, write: if request.auth != null && request.auth.uid == resource.data.userId; } } }`).
    * In your Firebase project settings, find your **Web app configuration** keys (apiKey, authDomain, projectId, etc.).

4.  **Configure Environment Variables:**
    * Create a file named `.env` in the root directory of the project.
    * Add your Firebase configuration keys, prefixed with `VITE_`:
        ```env
        # .env
        VITE_FIREBASE_API_KEY=YOUR_API_KEY
        VITE_FIREBASE_AUTH_DOMAIN=YOUR_AUTH_DOMAIN
        VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
        VITE_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
        VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_MESSAGING_SENDER_ID
        VITE_FIREBASE_APP_ID=YOUR_APP_ID
        ```
    * **Important:** Add `.env` to your `.gitignore` file to avoid committing your secret keys.

5.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    Open your browser to the local address provided by Vite (usually `http://localhost:5173` or similar).

## Future Improvements

* Implement heatmap visualization using captured location data.
* Add summary statistics dashboard.
* Implement editing and deleting of log entries.
* Add filtering/sorting options to the history table.
* Support multiple vehicles.
* Add unit preferences (Metric/Imperial).
* Convert to a Progressive Web App (PWA).

## License

Whatever.
