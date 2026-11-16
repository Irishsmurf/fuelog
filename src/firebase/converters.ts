// Typed, validated reads from Firestore. Every document read in the app goes
// through `parseDoc`, which checks it against the shared @fuelog/core schema.
import * as Sentry from '@sentry/react';
import type { Timestamp, DocumentData } from 'firebase/firestore';
import { z } from 'zod';
import {
  createFuelLogSchema, createApiTokenSchema, vehicleSchema, stationSchema, userProfileSchema,
} from '@fuelog/core';

/**
 * Accepts Firestore client Timestamps. Checked structurally (a `toDate`
 * method) rather than with `instanceof`, which breaks across SDK copies and
 * for test doubles.
 */
export const timestampSchema = z.custom<Timestamp>(
  (v) => typeof (v as { toDate?: unknown } | null)?.toDate === 'function',
  { message: 'Expected a Firestore Timestamp' },
);

export const fuelLogSchema = createFuelLogSchema(timestampSchema);
export const apiTokenSchema = createApiTokenSchema(timestampSchema);
export { vehicleSchema, stationSchema, userProfileSchema };

export type FuelLogDoc = z.output<typeof fuelLogSchema>;

const reported = new Set<string>();

/**
 * Parses a document with `schema`. A document that does not match is *not*
 * dropped — hiding a user's data is worse than showing an odd value — but it
 * is reported (once per doc) so schema drift is visible instead of silent.
 */
export function parseDoc<S extends z.ZodType>(
  schema: S,
  kind: string,
  id: string,
  data: DocumentData | undefined,
): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const key = `${kind}/${id}`;
  if (!reported.has(key)) {
    reported.add(key);
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    console.warn(`Invalid ${kind} document ${id}:`, issues);
    Sentry.captureMessage(`Invalid ${kind} document`, { level: 'warning', extra: { id, issues } });
  }
  return data as z.output<S>;
}

/** Convenience: parse a snapshot-like `{ id, data() }` and attach its id. */
export function withId<S extends z.ZodType>(
  schema: S,
  kind: string,
  snap: { id: string; data: () => DocumentData | undefined },
): z.output<S> & { id: string } {
  const parsed = parseDoc(schema, kind, snap.id, snap.data()) as Record<string, unknown>;
  return { ...parsed, id: snap.id } as z.output<S> & { id: string };
}

/** For tests: forget which documents were already reported. */
export function resetReported(): void {
  reported.clear();
}
