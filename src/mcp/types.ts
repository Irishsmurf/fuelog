import type { Timestamp } from 'firebase-admin/firestore';

export interface ServerLog {
  id: string;
  userId: string;
  timestamp: Timestamp;
  brand: string;
  cost: number;
  distanceKm: number;
  fuelAmountLiters: number;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  currency?: string;
  originalCost?: number;
  exchangeRate?: number;
  vehicleId?: string;
  receiptUrl?: string;
}

export interface ServerVehicle {
  id: string;
  userId: string;
  name: string;
  make: string;
  model: string;
  year: string;
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  isDefault: boolean;
  isArchived?: boolean;
}

export interface ServerUserProfile {
  homeCurrency: string;
}

export interface AnalyticsSummary {
  totalLogs: number;
  totalSpent: number;
  homeCurrency: string;
  totalFuelLiters: number;
  totalDistanceKm: number;
  averageEfficiency: {
    kml: number | null;
    l100km: number | null;
    mpg: number | null;
  };
  averageCostPerLiter: number | null;
  dateRange: { from: string | null; to: string | null };
}

export interface MonthlyDataPoint {
  month: string;
  totalSpent: number;
  totalLiters: number;
  totalDistanceKm: number;
  logCount: number;
  avgEfficiencyKml: number | null;
  avgCostPerLiter: number | null;
}

export interface VehicleStats {
  vehicleId: string;
  vehicleName: string;
  logCount: number;
  totalSpent: number;
  totalLiters: number;
  totalDistanceKm: number;
  avgEfficiencyKml: number | null;
  avgMpg: number | null;
  avgCostPerLiter: number | null;
}
