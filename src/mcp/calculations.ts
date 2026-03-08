const LITRES_TO_UK_GALLONS = 4.54609;
const KM_TO_MILES = 1 / 1.60934;

export function calcMPG(distanceKm: number, fuelAmountLiters: number): number | null {
  if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
  try {
    const distanceMiles = distanceKm * KM_TO_MILES;
    const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS;
    return distanceMiles / gallonsUK;
  } catch { return null; }
}

export function calcKmL(distanceKm: number, fuelAmountLiters: number): number | null {
  if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
  try { return distanceKm / fuelAmountLiters; } catch { return null; }
}

export function calcL100km(distanceKm: number, fuelAmountLiters: number): number | null {
  if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
  try { return (fuelAmountLiters / distanceKm) * 100; } catch { return null; }
}

export function calcFuelPrice(cost: number, fuelAmountLiters: number): number | null {
  if (!cost || cost <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null;
  try { return cost / fuelAmountLiters; } catch { return null; }
}

export function calcCostPerKm(cost: number, distanceKm: number): number | null {
  if (!cost || cost <= 0 || !distanceKm || distanceKm <= 0) return null;
  try { return cost / distanceKm; } catch { return null; }
}
