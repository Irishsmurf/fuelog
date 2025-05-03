// src/firebase/remoteConfigService.ts
import { getRemoteConfig, fetchAndActivate, getValue, RemoteConfig } from "firebase/remote-config";
import { app } from './config'; // Import the initialized Firebase app instance

// --- Initialize Remote Config ---
const remoteConfig: RemoteConfig = getRemoteConfig(app);

// Set default values (match console defaults)
// Fetching happens infrequently, so defaults are important for first load or offline scenarios
remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // Cache for 1 hour (adjust as needed for development/production)
remoteConfig.defaultConfig = {
  "darkModeEnabled": false, // Default value if fetch fails or before first fetch
  // Add other remote config defaults here if needed
};
console.log("Remote Config initialized with defaults.");
// --- End Remote Config Initialization ---


/**
 * Fetches the latest Remote Config values from the Firebase backend and activates them.
 * Activation makes the fetched values available to the app via `getValue`.
 * It respects the `minimumFetchIntervalMillis` setting to avoid excessive fetching.
 */
const activateRemoteConfig = async (): Promise<boolean> => {
  try {
    const fetched = await fetchAndActivate(remoteConfig);
    if (fetched) {
      console.log("Remote Config fetched and activated.");
    } else {
      console.log("Remote Config using cached values (or defaults - within fetch interval).");
    }
    return fetched; // Indicates if new values were fetched and activated
  } catch (error) {
    console.error("Remote Config fetch failed:", error);
    return false; // Fetch or activation failed
  }
};

/**
 * Gets the boolean value for the 'darkModeEnabled' parameter from Remote Config.
 * Uses the activated value (or default if activation hasn't happened/failed).
 * @returns {boolean} The value of the 'darkModeEnabled' parameter.
 */
const isDarkModeEnabled = (): boolean => {
    return getValue(remoteConfig, "darkModeEnabled").asBoolean();
};

// Export the functions and the instance if needed elsewhere (though usually functions are preferred)
export {
  remoteConfig, // Export instance if direct access is needed (less common)
  activateRemoteConfig,
  isDarkModeEnabled,
  getValue // Re-export getValue for accessing other parameters if necessary
};
