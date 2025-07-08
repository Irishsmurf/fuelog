# Firebase Remote Config Usage Guide

This document explains how to use Firebase Remote Config to manage feature flags and other dynamic configurations within this application.

## 1. Overview

Firebase Remote Config allows you to change the behavior and appearance of your app without publishing an app update. It's a powerful way to:

*   Roll out new features gradually.
*   A/B test different UI variations or features.
*   Enable or disable features dynamically.
*   Change app configurations (e.g., API endpoints, display settings) remotely.

The core setup is located in `src/firebase/remoteConfigService.ts`. This service initializes Remote Config, fetches values from the Firebase console, and provides getter functions to access these values.

## 2. Adding New Feature Flags or Configuration Parameters

To add a new feature flag or configuration parameter, follow these steps:

### Step 2.1: Define in Firebase Remote Config Console

1.  Go to your Firebase project in the Firebase console.
2.  Navigate to **Remote Config** (usually under the "Engage" section).
3.  Click on **"Add parameter"** or **"Create configuration"**.
4.  **Parameter key:** Define a unique key for your flag (e.g., `newAwesomeFeatureEnabled`, `homepageTitleText`).
    *   Use camelCase or snake_case consistently.
5.  **Data type:** Choose the appropriate data type (String, Boolean, Number, JSON).
6.  **Default value (server-side):** Set a default value that will be used if no other conditions match or if the app can't fetch. This is *different* from the in-app default.
7.  Optionally, add conditional values based on user properties, audiences, etc.
8.  **Publish changes:** Remember to click **"Publish changes"** in the Firebase console for your new parameters to go live.

### Step 2.2: Define In-App Default Value

It's crucial to define a corresponding in-app default value in `src/firebase/remoteConfigService.ts`. This value is used:
*   Before the app successfully fetches values from the backend for the first time.
*   If the app is offline and has no cached values.
*   If a key is fetched but somehow becomes undefined (rare).

Open `src/firebase/remoteConfigService.ts` and add your new key and its default value to the `remoteConfigInstance.defaultConfig` object:

```typescript
// src/firebase/remoteConfigService.ts

remoteConfigInstance.defaultConfig = {
  "darkModeEnabled": false,
  "exampleFeatureFlagEnabled": false,
  // Add your new parameter here
  "newAwesomeFeatureEnabled": false, // Default for a boolean flag
  "homepageTitleText": "Welcome!",  // Default for a string
  "maxItemsToList": 15             // Default for a number
  // ... other existing defaults
};
```

## 3. Accessing Feature Flag Values in Code

The `src/firebase/remoteConfigService.ts` exports several getter functions to access the activated Remote Config values:

*   `getBoolean(key: string): boolean`
*   `getString(key: string): string`
*   `getNumber(key: string): number`
*   `getRemoteConfigValue(key: string): Value` (returns the raw Firebase `Value` object)

**Activation:** The `activateRemoteConfig()` function is called automatically in `src/main.tsx` when the app starts. This fetches and activates the latest values.

### Example Usage in a React Component:

```tsx
import React from 'react';
import { getBoolean, getString } from '../firebase/remoteConfigService'; // Adjust path as needed

const MyComponent: React.FC = () => {
  const isNewFeatureOn = getBoolean("newAwesomeFeatureEnabled");
  const title = getString("homepageTitleText");

  return (
    <div>
      <h1>{title}</h1>
      {isNewFeatureOn && (
        <p>The new awesome feature is here!</p>
      )}
      {!isNewFeatureOn && (
        <p>The new feature is coming soon...</p>
      )}
    </div>
  );
};

export default MyComponent;
```

### Example: `exampleFeatureFlagEnabled`

An example implementation using the `exampleFeatureFlagEnabled` flag can be found in `src/pages/AboutPage.tsx`. This flag controls the visibility of a "New Feature Showcase" section on the About page.

To test this:
1.  Ensure `exampleFeatureFlagEnabled` is defined in your Firebase Remote Config console.
2.  Change its value (true/false) in the console and publish the changes.
3.  Reload the application. The "New Feature Showcase" section on the About page should appear or disappear based on the fetched value. (Note: due to `minimumFetchIntervalMillis`, you might need to wait or force a fetch if testing rapidly).

## 4. Best Practices

*   **Define all keys:** Ensure every key you use in your code is defined in the Firebase console and has an in-app default in `remoteConfigService.ts`.
*   **Use descriptive keys:** Make keys clear and understandable.
*   **Fetch interval:** Be mindful of `minimumFetchIntervalMillis`. For development, you might set it to a very low value (e.g., `0` or a few seconds, but Firebase still imposes some limits). For production, use a longer interval (e.g., 1 to 12 hours) to avoid excessive network requests and potential throttling.
*   **Error Handling:** While `activateRemoteConfig` includes basic error logging, consider more sophisticated error handling or user feedback if Remote Config values are critical for app functionality.
*   **Stale-while-revalidate:** The current setup fetches and activates. Fetched values are available on the *next* app load or after a delay if not handled carefully. If you need immediate updates after a fetch within the same session, you might need to implement a listener or re-render mechanism, which is more advanced. For most feature flags, activating and then using the values on subsequent component renders or app navigations is sufficient.

By following this guide, you can effectively leverage Firebase Remote Config to dynamically manage your application's features and configurations.
