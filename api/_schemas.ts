import { z } from 'zod';

/**
 * Request-body schemas for the REST API. Unknown keys are stripped, so only
 * the fields listed here can ever reach Firestore (userId, id, stationId,
 * receipt fields, etc. cannot be set through the API).
 */

const nonNegative = z.number().finite().nonnegative();
const positive = z.number().finite().positive();

export const isoDateString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' });

export const MAX_LIST_LIMIT = 500;
export const DEFAULT_LIST_LIMIT = 100;

export const logCreateSchema = z.object({
  brand: z.string().trim().min(1).max(200),
  cost: nonNegative,
  distanceKm: nonNegative,
  fuelAmountLiters: positive,
  timestamp: isoDateString.optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Expected a 3-letter ISO currency code').optional(),
  originalCost: nonNegative.optional(),
  exchangeRate: positive.optional(),
  vehicleId: z.string().min(1).max(128).optional(),
  odometerKm: nonNegative.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const logUpdateSchema = logCreateSchema.partial();

const fuelType = z.enum(['Petrol', 'Diesel', 'Hybrid', 'Electric']);
// Vehicles store year as a string; accept numbers for API convenience.
const year = z.union([z.string().trim().min(1).max(10), z.number().int()]).transform(String);

export const vehicleCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year,
  fuelType,
  isDefault: z.boolean().optional(),
});

export const vehicleUpdateSchema = vehicleCreateSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

/** Formats zod issues into a compact, client-readable message. */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}

/** Parses the `limit` query param, clamped to [1, MAX_LIST_LIMIT]. */
export function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.floor(n), MAX_LIST_LIMIT);
}
