import { getAnalytics, setUserProperties, Analytics, isSupported } from "firebase/analytics";
import { app } from './config';

let analyticsInstance: Analytics | null = null;

const getAnalyticsInstance = async (): Promise<Analytics | null> => {
  if (analyticsInstance) return analyticsInstance;
  const supported = await isSupported();
  if (!supported) return null;
  analyticsInstance = getAnalytics(app);
  return analyticsInstance;
};

/**
 * Sets the tester_group user property on the Firebase Analytics instance.
 * Used by Remote Config to target the "Internal Testers" condition.
 * Call with 'internal' for testers, null to clear (e.g. on sign-out).
 */
export const setTesterGroup = async (group: 'internal' | null): Promise<void> => {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  setUserProperties(analytics, { tester_group: group });
};
