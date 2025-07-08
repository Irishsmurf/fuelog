// src/firebase/remoteConfigService.ts
import { getRemoteConfig, fetchAndActivate, getValue, RemoteConfig, Value } from "firebase/remote-config";
import { app } from './config'; // Import the initialized Firebase app instance

// --- Initialize Remote Config ---
const remoteConfigInstance: RemoteConfig = getRemoteConfig(app);

/**
 * Default configuration values for Remote Config.
 * These values are used if the app cannot fetch values from the Firebase backend,
 * or before the first fetch completes.
 * It's crucial to define defaults for all keys you intend to use.
 *
 * Example:
 * "newFeatureEnabled": false,
 * "welcomeMessage": "Hello from defaults!",
 * "maxItemsPerPage": 10
 */
remoteConfigInstance.defaultConfig = {
  "darkModeEnabled": false,
  "exampleFeatureFlagEnabled": false, // Added for the example in step 3
  "costPerLitreGraphEnabled": false, // Feature flag for Cost Per Litre graph
  // Add other remote config defaults here as key-value pairs
  // e.g., "showNewDashboard": false,
  //       "apiEndpoint": "https://api.example.com/v1"
};

// Set minimum fetch interval. For development, you might want a lower value.
// For production, a higher value (e.g., 1 hour to 12 hours) is typical.
// Value is in milliseconds. 3600000ms = 1 hour.
remoteConfigInstance.settings.minimumFetchIntervalMillis = 3600000;

console.log("Remote Config initialized with defaults and settings.");
// --- End Remote Config Initialization ---

/**
 * Fetches the latest Remote Config values from the Firebase backend and activates them.
 * Activation makes the fetched values available to the app via `getValue`, `getString`, etc.
 * This function respects the `minimumFetchIntervalMillis` setting to avoid excessive fetching.
 * It should typically be called once during app initialization.
 * @returns {Promise<boolean>} A promise that resolves to `true` if new values were fetched and activated,
 *                             and `false` if cached values were used (or if the fetch failed).
 */
const activateRemoteConfig = async (): Promise<boolean> => {
  try {
    const fetched = await fetchAndActivate(remoteConfigInstance);
    if (fetched) {
      console.log("Remote Config: Fresh values fetched and activated.");
    } else {
      console.log("Remote Config: Using cached values (or defaults if cache is empty/expired).");
    }
    return fetched;
  } catch (error) {
    console.error("Remote Config: Fetch and activate failed.", error);
    return false; // Indicates that the fetch or activation process failed
  }
};

/**
 * Retrieves a configuration value from Remote Config as a boolean.
 * @param {string} key The configuration key.
 * @returns {boolean} The boolean value of the parameter. Falls back to the default value
 *                    defined in `remoteConfigInstance.defaultConfig` if the key is not found
 *                    or if the fetched value cannot be converted to a boolean.
 */
const getBoolean = (key: string): boolean => {
  return getValue(remoteConfigInstance, key).asBoolean();
};

/**
 * Retrieves a configuration value from Remote Config as a string.
 * @param {string} key The configuration key.
 * @returns {string} The string value of the parameter. Falls back to the default value
 *                   (converted to a string) if the key is not found.
 */
const getString = (key: string): string => {
  return getValue(remoteConfigInstance, key).asString();
};

/**
 * Retrieves a configuration value from Remote Config as a number.
 * @param {string} key The configuration key.
 * @returns {number} The number value of the parameter. Falls back to the default value
 *                   (converted to a number) if the key is not found or if the fetched value
 *                   cannot be converted to a number.
 */
const getNumber = (key: string): number => {
  return getValue(remoteConfigInstance, key).asNumber();
};

/**
 * Retrieves a configuration value from Remote Config directly as a Firebase Value object.
 * This can be useful if you need to check the source of the value or handle types more dynamically.
 * @param {string} key The configuration key.
 * @returns {Value} The Firebase Value object.
 */
const getRemoteConfigValue = (key: string): Value => {
  return getValue(remoteConfigInstance, key);
};

// Export the functions and the instance for direct access if needed (though functions are preferred)
export {
  remoteConfigInstance, // Export instance for advanced use cases or debugging
  activateRemoteConfig,
  getBoolean,
  getString,
  getNumber,
  getRemoteConfigValue // Re-exporting getValue essentially, but named for clarity
};
