# Feature Releasing with Firebase Remote Config

This guide outlines the process for implementing **Feature Flags** (Toggles) in Fuelog to enable safer deployments, A/B testing, and phased rollouts.

---

## 1. Define the Parameter (Code)

Before using a flag in your components, you must register it in `src/firebase/remoteConfigService.ts` to ensure type safety and provide a fallback.

### Step 1: Add a Default Value
Open `src/firebase/remoteConfigService.ts` and add your new key to the `defaultConfig` object:

```typescript
remoteConfigInstance.defaultConfig = {
  "darkModeEnabled": true,
  "myAwesomeFeatureEnabled": false, // <-- Your new flag
  // ...
};
```

---

## 2. Consume the Parameter (React)

To use the flag in a component, use the `useRemoteConfig` hook. This ensures your component re-renders correctly once the configuration is fetched.

### Step 2: Access in a Component
In `src/pages/MyNewPage.tsx`:

```tsx
import { useRemoteConfig } from '../context/RemoteConfigContext';

export const MyNewPage = () => {
  const { getBoolean, loading } = useRemoteConfig();
  const isEnabled = getBoolean("myAwesomeFeatureEnabled");

  if (loading) {
    return <div>Loading configuration...</div>;
  }

  if (!isEnabled) {
    return <div>This feature is coming soon!</div>;
  }

  return (
    <div>
      <h1>Welcome to My Awesome Feature</h1>
      {/* Feature Content */}
    </div>
  );
};
```

---

## 3. Configure in Firebase Console

Once the code is merged and deployed, you can control the visibility of the feature without pushing new code.

### Step 3: Create the Parameter
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **Release & Monitor > Remote Config**.
3. Click **Add parameter**.
4. Set the **Parameter key** to `myAwesomeFeatureEnabled`.
5. Set the **Data type** to `Boolean`.
6. Set the **Default value** (e.g., `false`).
7. Click **Save**.

### Step 4: Perform a Phased Rollout (Optional)
Instead of enabling the feature for everyone, you can target specific users:
1. Click **Add new** on your parameter's value.
2. Select **Conditional value > Create new condition**.
3. Define a condition (e.g., "50% of users" or "Users in Germany").
4. Click **Publish changes** to make it live.

---

## 4. Best Practices

- **Naming:** Use the `Enabled` suffix for booleans (e.g., `dashboardRevampEnabled`).
- **Cleanup:** Once a feature is fully released and stable, **remove the flag** from the code and the Firebase Console to reduce technical debt.
- **Critical Features:** Do not use Remote Config for security-sensitive logic (e.g., hiding an admin panel). Remote Config values can be manipulated by advanced users on the client side.
- **Fetch Frequency:** The app currently fetches once per hour (`minimumFetchIntervalMillis = 3600000`). If you update a value in the console, users may not see it for up to 60 minutes.
