import type { StationDoc } from './schema.js';

/**
 * Presents a station's price stats in one viewer currency. When the
 * server-maintained `priceStats` exist, only the viewer's currency bucket is
 * used (no bucket = no price shown, rather than a figure in another
 * currency). Stations not yet migrated keep their legacy aggregates.
 */
export function localizeStation<T extends Pick<StationDoc, 'avgPrice' | 'lastPrice' | 'logCount' | 'priceStats'>>(
  station: T,
  currency: string,
): T {
  if (!station.priceStats) return station;
  const s = station.priceStats[currency];
  return {
    ...station,
    avgPrice: s && s.count > 0 ? s.avgPrice : undefined,
    lastPrice: s?.lastPrice ?? undefined,
    logCount: s?.count ?? 0,
  };
}
