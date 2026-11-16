import {
  mpgUK, kmPerLitre, litresPer100km, pricePerLitre, costPerMile, distanceFromOdometer, getMonthlyTotals,
} from '@fuelog/core';
import type { MonthlyTotal } from '@fuelog/core';

/**
 * Display helpers for the web app. The maths lives in `@fuelog/core`; these
 * only format results ("N/A" when a value can't be computed).
 */

const fixed = (n: number | null, digits: number): string => (n === null ? 'N/A' : n.toFixed(digits));

const formatMPG = (distanceKm: number, fuelAmountLiters: number): string =>
  fixed(mpgUK(distanceKm, fuelAmountLiters), 2);

/** Cost per mile prefixed with the caller's currency symbol (home currency). */
const formatCostPerMile = (cost: number, distanceKm: number, currencySymbol: string): string => {
  const value = costPerMile(cost, distanceKm);
  return value === null ? 'N/A' : `${currencySymbol}${value.toFixed(3)}`;
};

const formatKmL = (distanceKm: number, fuelAmountLiters: number): string =>
  fixed(kmPerLitre(distanceKm, fuelAmountLiters), 2);

const formatL100km = (distanceKm: number, fuelAmountLiters: number): string =>
  fixed(litresPer100km(distanceKm, fuelAmountLiters), 2);

const getNumericMPG = (distanceKm: number, fuelAmountLiters: number): number | null =>
  mpgUK(distanceKm, fuelAmountLiters);

const getNumericFuelPrice = (cost: number, fuelAmountLiters: number): number | null =>
  pricePerLitre(cost, fuelAmountLiters);

const calculateDistance = (currentOdometer: number, previousOdometer: number): number | null =>
  distanceFromOdometer(currentOdometer, previousOdometer);

export {
  formatMPG, formatCostPerMile, formatKmL, formatL100km, getNumericMPG, getNumericFuelPrice, calculateDistance,
  getMonthlyTotals,
};
export type { MonthlyTotal };
