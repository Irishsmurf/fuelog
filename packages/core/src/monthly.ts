export interface MonthlyTotal {
  /** Year-month key in 'YYYY-MM' format, used for stable sorting/lookup. */
  monthKey: string;
  /** Start-of-month Date for this bucket, useful for formatting with Intl. */
  monthStart: Date;
  totalCost: number;
  totalLitres: number;
  logCount: number;
}

export interface MonthlyAggregatable {
  timestamp: { toDate: () => Date };
  cost: number;
  fuelAmountLiters: number;
}

export const monthKeyOf = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Buckets logs into the trailing `monthsBack` calendar months (inclusive of the
 * current month), zero-filling months with no logs so charts render a continuous
 * timeline rather than skipping gaps.
 */
export function getMonthlyTotals<T extends MonthlyAggregatable>(
  logs: T[],
  monthsBack: number = 6,
  referenceDate: Date = new Date(),
): MonthlyTotal[] {
  const buckets = new Map<string, MonthlyTotal>();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const key = monthKeyOf(monthStart);
    buckets.set(key, { monthKey: key, monthStart, totalCost: 0, totalLitres: 0, logCount: 0 });
  }

  for (const log of logs) {
    const bucket = buckets.get(monthKeyOf(log.timestamp.toDate()));
    if (!bucket) continue; // Outside the requested window
    bucket.totalCost += log.cost;
    bucket.totalLitres += log.fuelAmountLiters;
    bucket.logCount += 1;
  }

  return Array.from(buckets.values());
}
