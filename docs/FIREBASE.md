# Firebase Configuration & Security

## Services Used
- **Authentication:** Google Sign-In.
- **Firestore:** NoSQL Document Database.
- **Remote Config:** Feature flagging and dynamic configuration.

## Firestore Schema

### Collection: `fuelLogs`
| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | `string` | UID of the owner (from Firebase Auth). |
| `timestamp` | `Timestamp` | Date and time of the fuel entry. |
| `brand` | `string` | Filling station brand (e.g., "Circle K"). |
| `cost` | `number` | Total cost of the transaction in Euro. |
| `distanceKm` | `number` | Distance covered since the last log in Km. |
| `fuelAmountLiters` | `number` | Amount of fuel added in Litres. |
| `latitude` | `number` | (Optional) GPS Latitude. |
| `longitude` | `number` | (Optional) GPS Longitude. |
| `locationAccuracy` | `number` | (Optional) GPS accuracy in meters. |

## Security Rules (Firestore)
The following rules ensure that users can only read and write their own data.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fuelLogs/{logId} {
      // Allow read/write only if the user is authenticated 
      // AND the document's userId matches the authenticated user's UID.
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      
      // Allow creation if the userId in the new data matches the authenticated user's UID.
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Remote Config Parameters
Managed in the Firebase Console and fetched during app initialization.

| Key | Default | Description |
| :--- | :--- | :--- |
| `darkModeEnabled` | `false` | Global override for dark mode (if needed). |
| `costPerLitreGraphEnabled` | `false` | Feature flag for the Cost Per Litre trend graph. |
| `totalSpentDisplayEnabled` | `false` | Feature flag for the "Total Lifetime Spent" display. |
| `exampleFeatureFlagEnabled` | `false` | Generic example flag for testing. |

### Fetch Policy
- **Minimum Fetch Interval:** 1 hour (3,600,000 ms).
- **Initialization:** Called in `src/main.tsx` via `activateRemoteConfig()`.
