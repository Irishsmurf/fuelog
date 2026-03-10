// src/firebase/remoteConfigService.ts
import { getRemoteConfig, fetchAndActivate, getValue, RemoteConfig, Value } from "firebase/remote-config";
import { app } from './config'; // Import the initialized Firebase app instance

const DEFAULT_CONFIG: Record<string, boolean | string | number> = {
  "darkModeEnabled": true,
  "exampleFeatureFlagEnabled": false,
  "costPerLitreGraphEnabled": false,
  "totalSpentDisplayEnabled": false,
  "receiptDigitizationEnabled": false,
  "receiptAutoFillEnabled": false,
};

// --- Initialize Remote Config ---
// Initialization can fail in environments where IndexedDB is unavailable (e.g. private/incognito
// browsing mode). We catch this at module load time and fall back to defaults-only mode.
let remoteConfigInstance: RemoteConfig | null = null;
try {
  remoteConfigInstance = getRemoteConfig(app);
  remoteConfigInstance.defaultConfig = DEFAULT_CONFIG;
  remoteConfigInstance.settings.minimumFetchIntervalMillis = 3600000;
  console.log("Remote Config initialized with defaults and settings.");
} catch (error) {
  console.warn("Remote Config: Failed to initialize (IndexedDB may be unavailable). Falling back to defaults.", error);
}
// --- End Remote Config Initialization ---

/**
 * Fetches the latest Remote Config values from the Firebase backend and activates them.
 */
const activateRemoteConfig = async (): Promise<boolean> => {
  if (!remoteConfigInstance) {
    console.warn("Remote Config: Skipping fetch — not initialized. Using defaults.");
    return false;
  }
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
    return false;
  }
};

/**
 * Retrieves a configuration value as a boolean. Falls back to the default config if Remote Config
 * is unavailable.
 */
const getBoolean = (key: string): boolean => {
  if (!remoteConfigInstance) {
    const val = DEFAULT_CONFIG[key];
    return typeof val === "boolean" ? val : Boolean(val);
  }
  return getValue(remoteConfigInstance, key).asBoolean();
};

/**
 * Retrieves a configuration value as a string.
 */
const getString = (key: string): string => {
  if (!remoteConfigInstance) {
    const val = DEFAULT_CONFIG[key];
    return val !== undefined ? String(val) : "";
  }
  return getValue(remoteConfigInstance, key).asString();
};

/**
 * Retrieves a configuration value as a number.
 */
const getNumber = (key: string): number => {
  if (!remoteConfigInstance) {
    const val = DEFAULT_CONFIG[key];
    return typeof val === "number" ? val : Number(val);
  }
  return getValue(remoteConfigInstance, key).asNumber();
};

/**
 * Retrieves a configuration value as a Firebase Value object.
 */
const getRemoteConfigValue = (key: string): Value => {
  if (!remoteConfigInstance) {
    throw new Error(`Remote Config not initialized; use getBoolean/getString/getNumber for key "${key}"`);
  }
  return getValue(remoteConfigInstance, key);
};

export {
  remoteConfigInstance,
  activateRemoteConfig,
  getBoolean,
  getString,
  getNumber,
  getRemoteConfigValue,
};
