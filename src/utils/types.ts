import { Timestamp } from 'firebase/firestore';

interface Vehicle {
    id: string;
    registrationPlate: string;
    userId: string;
    make: string;
    model: string;
    fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid' | 'Other';
    initialOdometerKm: number;
    currentOdometerKm: number;
    lastOdometerKm: number;
}

interface FuelLogData {
    userId: string;
    vehicleId: string;
    timestamp: Timestamp;
    brand: string;
    cost: number;
    distanceKm?: number;
    odometerKm?: number;
    mileageInputMethod?: 'distance' | 'odometer';
    fuelAmountLiters: number;
    latitude?: number;
    longitude?: number;
    locationAccuracy?: number;
}

interface Log extends FuelLogData {
    id: string;
}

interface ProcessedLog extends Omit<Log, 'distanceKm'> {
    distanceKm: number; // Ensure distanceKm is always a number for display/calculation components
    // odometerKm remains optional as it might not always be present/relevant for display
    odometerKm?: number;
}

// Defines the structure of data points prepared specifically for the Recharts library
interface ChartDataPoint {
    date: string;
    timestampValue: number;
    mpg: number | null;
    cost: number | null;
    fuelPrice: number | null;
    vehicleId?: string;
}
// Type for the state holding the specific log currently being edited in the modal
type EditingLogState = Log | null;
// Type for the state managing the input values within the Edit modal form
interface EditFormData {
    brand: string;
    cost: string;
    fuelAmountLiters: string;
    odometerKm?: string;
    distanceKm?: string;
    mileageInputMethod: 'distance' | 'odometer' | '';
    vehicleId: string;
}
// Type for view mode state
type ViewMode = 'table' | 'cards';


export type {
    Vehicle,
    FuelLogData, 
    Log, 
    ChartDataPoint, 
    ViewMode, 
    EditFormData, 
    EditingLogState,
    ProcessedLog
};