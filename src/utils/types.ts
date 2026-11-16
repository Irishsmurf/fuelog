import { Timestamp } from 'firebase/firestore';

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;   // First 9 chars of raw token e.g. "flog_a3f2", for display only
  scopes: string[];
  createdAt: Timestamp;
  lastUsedAt: Timestamp | null;
  isRevoked: boolean;
  expiresAt?: Timestamp | null;
}

import type { z } from 'zod';
import type { VehicleFuelType } from '@fuelog/core';
import type { fuelLogSchema, vehicleSchema, stationSchema } from '../firebase/converters';

// Persisted document types are derived from the shared @fuelog/core schemas
// (see src/firebase/converters.ts), so types and runtime validation can't drift.

/** A fuel log as stored in Firestore. `cost` is in the user's HOME currency. */
type FuelLogData = z.output<typeof fuelLogSchema>;

interface Log extends FuelLogData {
    id: string;
}

type Vehicle = z.output<typeof vehicleSchema> & { id: string };

type Station = z.output<typeof stationSchema> & { id: string };

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
    odometerKm: string;
    vehicleId?: string; // Multi-vehicle support
    latitude?: string;
    longitude?: string;
    loggedAt?: string;  // datetime-local string for editing the fuelling date/time
}
// Type for view mode state
type ViewMode = 'table' | 'cards';


export type { FuelLogData, Log, ChartDataPoint, ViewMode, EditFormData, EditingLogState, Vehicle, VehicleFuelType, ApiToken, Station };