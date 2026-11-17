// Exchange rates (Frankfurter, via utils/currencyApi) as a cached query.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchExchangeRate } from '../utils/currencyApi';

const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Rates are daily, so the key is the local calendar day. */
export const exchangeRateKey = (date: Date, from: string, to: string) =>
  ['exchangeRate', localYmd(date), from, to] as const;

/**
 * The `from` -> `to` rate on `date`. A new currency/day keeps showing the
 * previous rate until its own arrives; superseded responses are ignored by
 * key, so a slow answer for an old currency can't overwrite a newer one.
 */
export function useExchangeRateQuery(date: Date, from: string, to: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: exchangeRateKey(date, from, to),
    queryFn: () => fetchExchangeRate(date, from, to),
    enabled: enabled && from !== to,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false,
  });
}
