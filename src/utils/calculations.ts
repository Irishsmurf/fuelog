const LITRES_TO_UK_GALLONS = 4.54609;
const KM_TO_MILES = 1 / 1.60934;

const formatMPG = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const distanceMiles = distanceKm * KM_TO_MILES; const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS; const mpg = distanceMiles / gallonsUK; return mpg.toFixed(2); } catch { return 'Error'; } };
const formatCostPerMile = (cost: number, distanceKm: number): string => { if (!cost || cost <= 0 || !distanceKm || distanceKm <= 0) return 'N/A'; try { const distanceMiles = distanceKm * KM_TO_MILES; const costPerMile = cost / distanceMiles; return `€${costPerMile.toFixed(3)}`; } catch { return 'Error'; } };
const formatKmL = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const kml = distanceKm / fuelAmountLiters; return kml.toFixed(2); } catch { return 'Error'; } };
const formatL100km = (distanceKm: number, fuelAmountLiters: number): string => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return 'N/A'; try { const l100km = (fuelAmountLiters / distanceKm) * 100; return l100km.toFixed(2); } catch { return 'Error'; } };
const getNumericMPG = (distanceKm: number, fuelAmountLiters: number): number | null => { if (!distanceKm || distanceKm <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null; try { const distanceMiles = distanceKm * KM_TO_MILES; const gallonsUK = fuelAmountLiters / LITRES_TO_UK_GALLONS; return distanceMiles / gallonsUK; } catch { return null; } };
const getNumericFuelPrice = (cost: number, fuelAmountLiters: number): number | null => { if (!cost || cost <= 0 || !fuelAmountLiters || fuelAmountLiters <= 0) return null; try { return cost / fuelAmountLiters; } catch { return null; } };

const calculateDistance = (currentOdometer: number, previousOdometer: number): number | null => {
    if (currentOdometer < 0 || previousOdometer < 0) return null;
    const diff = currentOdometer - previousOdometer;
    return diff > 0 ? diff : null;
};

interface MonthlyTotal {
    /** Year-month key in 'YYYY-MM' format, used for stable sorting/lookup. */
    monthKey: string;
    /** Start-of-month Date for this bucket, useful for formatting with Intl. */
    monthStart: Date;
    totalCost: number;
    totalLitres: number;
    logCount: number;
}

interface MonthlyAggregatable {
    timestamp: { toDate: () => Date };
    cost: number;
    fuelAmountLiters: number;
}

const monthKeyOf = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Buckets logs into the trailing `monthsBack` calendar months (inclusive of the
 * current month), zero-filling months with no logs so charts render a continuous
 * timeline rather than skipping gaps.
 */
const getMonthlyTotals = <T extends MonthlyAggregatable>(
    logs: T[],
    monthsBack: number = 6,
    referenceDate: Date = new Date()
): MonthlyTotal[] => {
    const buckets = new Map<string, MonthlyTotal>();

    for (let i = monthsBack - 1; i >= 0; i--) {
        const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
        const key = monthKeyOf(monthStart);
        buckets.set(key, { monthKey: key, monthStart, totalCost: 0, totalLitres: 0, logCount: 0 });
    }

    for (const log of logs) {
        const logDate = log.timestamp.toDate();
        const key = monthKeyOf(logDate);
        const bucket = buckets.get(key);
        if (!bucket) continue; // Outside the requested window
        bucket.totalCost += log.cost;
        bucket.totalLitres += log.fuelAmountLiters;
        bucket.logCount += 1;
    }

    return Array.from(buckets.values());
};

export {
    formatMPG, formatCostPerMile, formatKmL, formatL100km, getNumericMPG, getNumericFuelPrice, calculateDistance,
    getMonthlyTotals,
};
export type { MonthlyTotal };