import { Timestamp } from 'firebase/firestore';

// Add this new interface
export interface Vehicle {
  id: string;
  userId: string;
  name: string; // User-defined name, e.g., "My Sedan"
  make?: string; // e.g., "Toyota"
  model?: string; // e.g., "Camry"
  year?: number; // e.g., 2021
  // Add any other relevant vehicle properties here
  // e.g., odometerUnit?: 'km' | 'miles';
  // e.g., fuelType?: 'petrol' | 'diesel' | 'electric';
}

export interface FuelLogData {
    userId: string;
    timestamp: Timestamp;
    brand: string;
    cost: number;
    distanceKm: number;
    fuelAmountLiters: number;
    latitude?: number;
    longitude?: number;
    locationAccuracy?: number;
    vehicleId?: string; // Added optional vehicleId
  }

  export interface Log extends FuelLogData { // Ensure Log extends the updated FuelLogData
    id: string;
    // vehicleId is inherited from FuelLogData
}

// Defines the structure of data points prepared specifically for the Recharts library
export interface ChartDataPoint { // Keep ChartDataPoint as is unless vehicle info is needed here
    date: string;
    timestampValue: number;
    mpg: number | null;
    cost: number | null;
    fuelPrice: number | null;
}
// Type for the state holding the specific log currently being edited in the modal
export type EditingLogState = Log | null; // Keep as is
// Type for the state managing the input values within the Edit modal form
export interface EditFormData { // Keep as is, or update if vehicle info is edited here
    brand: string;
    cost: string;
    distanceKm: string;
    fuelAmountLiters: string;
}
// Type for view mode state
export type ViewMode = 'table' | 'cards'; // Keep as is


// Export Vehicle along with other types
export type { FuelLogData, Log, ChartDataPoint, ViewMode, EditFormData, EditingLogState, Vehicle }; // Added Vehicle