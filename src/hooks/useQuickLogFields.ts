// The Quick Log form's plain input values.
import { useMemo, useState } from 'react';
import { calculateDistance } from '../utils/calculations';
import { toDatetimeLocal } from '../utils/formatDate';
import type { FillType } from '@fuelog/core';

export function useQuickLogFields() {
  const [brand, setBrand] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [odometerKm, setOdometerKm] = useState<string>('');
  const [fuelAmountLiters, setFuelAmountLiters] = useState<string>('');
  // Efficiency is only exact between two full fills; a partial fill or a
  // skipped log makes the distance/fuel pairing approximate.
  const [fillType, setFillType] = useState<FillType>('full');
  const [missedPrevious, setMissedPrevious] = useState<boolean>(false);
  // Defaults to "now" but is fully editable so a delayed entry keeps the real
  // fuelling time rather than the submission time.
  const [loggedAt, setLoggedAt] = useState<string>(() => toDatetimeLocal(new Date()));

  /** The fuelling time as a Date, falling back to now while the input isn't parseable. */
  const loggedAtDate = useMemo(() => {
    const parsed = loggedAt ? new Date(loggedAt) : new Date();
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [loggedAt]);

  const reset = () => {
    setBrand(''); setCost(''); setDistanceKm(''); setFuelAmountLiters('');
    setOdometerKm('');
    setFillType('full'); setMissedPrevious(false);
    setLoggedAt(toDatetimeLocal(new Date()));
  };

  return {
    brand, setBrand, cost, setCost, distanceKm, setDistanceKm, odometerKm, setOdometerKm,
    fuelAmountLiters, setFuelAmountLiters, fillType, setFillType, missedPrevious, setMissedPrevious,
    loggedAt, setLoggedAt, loggedAtDate, reset,
  };
}

export type QuickLogFields = ReturnType<typeof useQuickLogFields>;

/**
 * Recalculates distance whenever the odometer reading or the last known
 * reading changes, so a late-arriving last reading (e.g. slow network) still
 * auto-fills the distance instead of being silently missed.
 */
export function useOdometerDistance(fields: QuickLogFields, lastOdometerReading: number | null) {
  const { odometerKm, setDistanceKm } = fields;
  // Adjusted during render when the inputs change (not in an effect).
  const [derivedFrom, setDerivedFrom] = useState<{ odometerKm: string; last: number | null }>({ odometerKm: '', last: null });
  if (derivedFrom.odometerKm !== odometerKm || derivedFrom.last !== lastOdometerReading) {
    setDerivedFrom({ odometerKm, last: lastOdometerReading });
    const parsedOdo = parseFloat(odometerKm);
    if (odometerKm && lastOdometerReading !== null && !isNaN(parsedOdo)) {
      const diff = calculateDistance(parsedOdo, lastOdometerReading);
      setDistanceKm(diff !== null ? diff.toFixed(1) : '');
    }
  }
}
