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

### Collection: `vehicles`
| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | `string` | UID of the owner. |
| `name` | `string` | Nickname for the vehicle. |
| `make` | `string` | e.g., "Volkswagen". |
| `model` | `string` | e.g., "Polo". |
| `year` | `string` | Manufacturing year. |
| `fuelType` | `string` | Petrol, Diesel, Hybrid, or Electric. |
| `isDefault` | `boolean` | Whether this is the primary vehicle for logging. |

### Collection: `userProfiles`
| Field | Type | Description |
| :--- | :--- | :--- |
| `homeCurrency` | `string` | User's preferred currency code (e.g., "GBP"). |

## Security Rules (Firestore)
The following rules ensure that users can only read and write their own data.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Rules for Fuel Logs
    match /fuelLogs/{logId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Rules for Vehicles
    match /vehicles/{vehicleId} {
      allow read, update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Rules for User Profiles
    match /userProfiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
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
