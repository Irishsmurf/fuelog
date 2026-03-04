import { Timestamp } from 'firebase/firestore';

type VehicleFuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';

interface Vehicle {
    id: string;
    userId: string;
    name: string; // Nickname for the vehicle
    make: string;
    model: string;
    year: string; // Kept as string for easier form handling, though numeric in usage
    fuelType: VehicleFuelType;
    isDefault: boolean;
    isArchived?: boolean; // Multi-vehicle support: Archive rentals/sold cars
}

interface FuelLogData {
    userId: string;
    timestamp: Timestamp;
    brand: string;
    cost: number; // This will now represent the cost in HOME currency (e.g., EUR)
    distanceKm: number;
    fuelAmountLiters: number;
    latitude?: number;
    longitude?: number;
    locationAccuracy?: number;
    
    // Multi-currency support
    currency?: string;          // e.g., "GBP"
    originalCost?: number;      // Amount in the transaction currency
    exchangeRate?: number;      // Rate used: 1 Transaction Currency = X Home Currency

    // Multi-vehicle support
    vehicleId?: string;         // Link to the vehicle (optional for backward compatibility)
    receiptUrl?: string;        // Optional URL for fuel receipt image (Cloud Storage)
  }

  interface Log extends FuelLogData {
    id: string;
}

// Defines the structure of data points prepared specifically for the Recharts library
interface ChartDataPoint {
    date: string;
    timestampValue: number;
    mpg: number | null;
    cost: number | null;
    fuelPrice: number | null;
}
// Type for the state holding the specific log currently being edited in the modal
type EditingLogState = Log | null;
// Type for the state managing the input values within the Edit modal form
interface EditFormData {
    brand: string;
    cost: string;
    distanceKm: string;
    fuelAmountLiters: string;
    vehicleId?: string; // Multi-vehicle support
}
// Type for view mode state
type ViewMode = 'table' | 'cards';


export type { FuelLogData, Log, ChartDataPoint, ViewMode, EditFormData, EditingLogState, Vehicle, VehicleFuelType };