# Feature Plan: Multi-Vehicle Support

## Overview
Allows users to manage fuel logs for multiple vehicles under a single account. Each log will be associated with a specific vehicle, and users can manage their vehicle fleet (Make, Model, Year, Fuel Type) in a new Profile/Settings page.

## User Requirements
- Create, edit, and delete vehicles in a "Profile" or "Settings" page.
- Select a vehicle when logging fuel.
- Filter history and charts by vehicle.
- Support for vehicle-specific defaults (e.g., fuel type, preferred units).

## Proposed Changes

### 1. Data Model (`src/utils/types.ts`)

**New `Vehicle` Interface:**
```typescript
interface Vehicle {
    id: string;
    userId: string;
    name: string; // Nickname for the vehicle
    make: string;
    model: string;
    year: number;
    fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
    isDefault: boolean;
}
```

**Updated `FuelLogData` Interface:**
```typescript
interface FuelLogData {
    // ... existing fields
    vehicleId: string; // Link to the vehicle
}
```

### 2. New Page: Profile Page (`src/pages/ProfilePage.tsx`)
- List all vehicles owned by the user.
- Form to add a new vehicle (Make, Model, Year, Fuel Type, Nickname).
- Ability to set a default vehicle.
- Ability to delete a vehicle (with a warning if logs are associated).

### 3. Quick Log Page (`src/pages/QuickLogPage.tsx`)
- Add a vehicle selector dropdown at the top of the form.
- Default to the user's "default" vehicle if set.
- If no vehicles are defined, prompt the user to create one first.

### 4. History Page (`src/pages/HistoryPage.tsx`)
- Add a "Vehicle" filter dropdown.
- Group or filter summary metrics and charts by the selected vehicle.
- Display the vehicle nickname in the history table/cards.

### 5. Navigation (`src/components/AuthenticatedApp.tsx`)
- Add a "Profile" link to the navigation bar.
- Add the route for `/profile`.

### 6. Logic Layer & Services
- Add Firestore functions to fetch, add, update, and delete vehicles.
- Update `pdfExport.ts` to include vehicle information in the report.

## Testing Strategy

### Unit Tests
- `src/utils/types.test.ts`: Verify data structures (if logic is added).
- `src/pages/ProfilePage.test.tsx`: Test vehicle CRUD operations (mocking Firestore).
- `src/pages/QuickLogPage.test.tsx`: Verify vehicle selection logic.

### E2E Tests (`e2e/multi_vehicle.spec.ts`)
- Navigate to Profile.
- Create a new vehicle.
- Navigate to Log page.
- Log fuel for the new vehicle.
- Navigate to History.
- Verify the log appears and filtering by vehicle works.

## Implementation Steps
1.  Update types in `src/utils/types.ts`.
2.  Create `ProfilePage.tsx` and register the route.
3.  Implement vehicle management logic (Firestore).
4.  Update `QuickLogPage` to include vehicle selection.
5.  Update `HistoryPage` to include vehicle filtering.
6.  Update `pdfExport` to handle vehicle data.
7.  Verify with tests.
