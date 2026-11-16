import { KM_PER_MILE, LITRES_PER_UK_GALLON } from './units.js';

/**
 * Fuel-economy and cost maths. Every function returns `null` when an input is
 * missing, zero or negative, so callers decide how to render "no value".
 * This is the single source of truth for these formulas — the web app, the
 * REST/MCP API and Cloud Functions all import from here.
 */

const isPositive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Miles per UK gallon. */
export function mpgUK(distanceKm: number, litres: number): number | null {
  if (!isPositive(distanceKm) || !isPositive(litres)) return null;
  return (distanceKm / KM_PER_MILE) / (litres / LITRES_PER_UK_GALLON);
}

/** Kilometres per litre. */
export function kmPerLitre(distanceKm: number, litres: number): number | null {
  if (!isPositive(distanceKm) || !isPositive(litres)) return null;
  return distanceKm / litres;
}

/** Litres per 100 km. */
export function litresPer100km(distanceKm: number, litres: number): number | null {
  if (!isPositive(distanceKm) || !isPositive(litres)) return null;
  return (litres / distanceKm) * 100;
}

/** Price per litre, in the currency of `cost`. */
export function pricePerLitre(cost: number, litres: number): number | null {
  if (!isPositive(cost) || !isPositive(litres)) return null;
  return cost / litres;
}

/** Cost per kilometre, in the currency of `cost`. */
export function costPerKm(cost: number, distanceKm: number): number | null {
  if (!isPositive(cost) || !isPositive(distanceKm)) return null;
  return cost / distanceKm;
}

/** Cost per mile, in the currency of `cost`. */
export function costPerMile(cost: number, distanceKm: number): number | null {
  if (!isPositive(cost) || !isPositive(distanceKm)) return null;
  return cost / (distanceKm / KM_PER_MILE);
}

/**
 * Distance driven between two odometer readings, or `null` when the readings
 * are invalid or do not increase (odometers only go up).
 */
export function distanceFromOdometer(currentKm: number, previousKm: number): number | null {
  if (!Number.isFinite(currentKm) || !Number.isFinite(previousKm)) return null;
  if (currentKm < 0 || previousKm < 0) return null;
  const diff = currentKm - previousKm;
  return diff > 0 ? diff : null;
}
