import { z } from 'zod';

/**
 * Persisted document schemas, shared by every reader and writer.
 *
 * Core has no Firebase dependency, so each schema is built by a factory that
 * takes the caller's timestamp validator: the web app passes Firestore's
 * client `Timestamp`, server code passes the Admin SDK one. Optional fields
 * stay optional so legacy documents still parse.
 */

export const CURRENT_SCHEMA_VERSION = 2;

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric'] as const;
export type VehicleFuelType = (typeof FUEL_TYPES)[number];

export const TOKEN_SCOPES = ['read:logs', 'write:logs', 'read:vehicles', 'write:vehicles'] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** full = tank filled to the brim (efficiency is measured between two full fills). */
export const FILL_TYPES = ['full', 'partial'] as const;
export type FillType = (typeof FILL_TYPES)[number];

export const LOG_SOURCES = ['app', 'import', 'api', 'mcp'] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

const finite = z.number().finite();

export const createFuelLogSchema = <TS extends z.ZodType>(timestamp: TS) =>
  z.object({
    userId: z.string().min(1),
    timestamp,
    brand: z.string().optional(),
    /** Cost in the user's home currency at the time of saving. */
    cost: finite,
    distanceKm: finite,
    fuelAmountLiters: finite,
    latitude: finite.optional(),
    longitude: finite.optional(),
    locationAccuracy: finite.optional(),
    odometerKm: finite.optional(),
    currency: z.string().optional(),
    originalCost: finite.optional(),
    /** 1 unit of `currency` = `exchangeRate` units of home currency. */
    exchangeRate: finite.optional(),
    vehicleId: z.string().optional(),
    receiptUrl: z.string().optional(),
    stationId: z.string().optional(),
    // Written by the onLogWrite Cloud Function (absent until a log is derived).
    /** Home-currency cost per litre. */
    pricePerLitre: finite.optional(),
    /** distanceKm / fuelAmountLiters. */
    kmPerLitre: finite.optional(),
    // v2 fields — absent on legacy documents.
    fillType: z.enum(FILL_TYPES).optional(),
    missedPrevious: z.boolean().optional(),
    source: z.enum(LOG_SOURCES).optional(),
    schemaVersion: z.number().int().optional(),
  });

export const vehicleSchema = z.object({
  userId: z.string().min(1),
  name: z.string(),
  make: z.string(),
  model: z.string(),
  // Stored as a string; tolerate legacy numeric years.
  year: z.union([z.string(), z.number()]).transform(String),
  fuelType: z.enum(FUEL_TYPES),
  isDefault: z.boolean().default(false),
  isArchived: z.boolean().optional(),
});

export const stationSchema = z.object({
  osmId: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  latitude: finite,
  longitude: finite,
  address: z.string().optional(),
  // Legacy client-maintained aggregates (currency-mixed). Superseded by priceStats.
  lastPrice: finite.optional(),
  avgPrice: finite.optional(),
  logCount: z.number().int().nonnegative().default(0),
  /** Server-maintained per-currency stats (updateStationStats Cloud Function). */
  priceStats: z.record(z.string(), z.object({
    count: z.number().int().nonnegative(),
    total: finite,
    avgPrice: finite,
    lastPrice: finite.nullable(),
    lastAt: finite.nullable(),
  })).optional(),
});

export const userProfileSchema = z.object({
  homeCurrency: z.string().default('EUR'),
  tester_group: z.boolean().default(false),
  monthlyBudget: finite.optional(),
  notificationsEnabled: z.boolean().optional(),
  hasSeenImportOnboarding: z.boolean().optional(),
});

export const createApiTokenSchema = <TS extends z.ZodType>(timestamp: TS) =>
  z.object({
    userId: z.string().min(1),
    name: z.string(),
    tokenPrefix: z.string(),
    tokenHash: z.string().length(64).optional(),
    scopes: z.array(z.string()),
    createdAt: timestamp,
    lastUsedAt: timestamp.nullable(),
    isRevoked: z.boolean(),
    expiresAt: timestamp.nullable().optional(),
  });

export type VehicleDoc = z.output<typeof vehicleSchema>;
export type StationDoc = z.output<typeof stationSchema>;
export type UserProfileDoc = z.output<typeof userProfileSchema>;
