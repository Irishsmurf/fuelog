// Transaction currency and its exchange rate to the home currency.
//
// The fetched rate comes from a query keyed by currency and fuelling day (a
// back-dated entry gets that day's rate). A rate the user types for a
// currency wins over fetched ones until the currency changes back to home or
// the log is saved. No effects: everything is derived or set in handlers.
import { ChangeEvent, useState } from 'react';
import type { TFunction } from 'i18next';
import { useExchangeRateQuery } from '../data/exchangeRates';
import type { SetMessage } from '../components/quicklog/types';

interface Options {
  homeCurrency: string;
  /** The fuelling date: a back-dated entry gets that day's rate. */
  rateDate: Date;
  setMessage: SetMessage;
  t: TFunction;
}

export function useExchangeRate({ homeCurrency, rateDate, setMessage, t }: Options) {
  const [currency, setCurrencyState] = useState<string>(homeCurrency);
  /** A rate the user typed, and the currency it is for. */
  const [manualRate, setManualRate] = useState<{ currency: string; rate: number } | null>(null);

  // Follow the home currency when it changes (e.g. once the profile loads).
  const [seenHome, setSeenHome] = useState(homeCurrency);
  if (seenHome !== homeCurrency) {
    setSeenHome(homeCurrency);
    setCurrencyState(homeCurrency);
    setManualRate(null);
  }

  const isManual = manualRate?.currency === currency;
  const rateQuery = useExchangeRateQuery(rateDate, currency, homeCurrency, { enabled: !isManual });

  // Report each failed fetch once (state adjusted during render, not in an effect).
  const [reportedErrorAt, setReportedErrorAt] = useState(0);
  if (rateQuery.isError && rateQuery.errorUpdatedAt !== reportedErrorAt) {
    setReportedErrorAt(rateQuery.errorUpdatedAt);
    console.error("Failed to fetch rate:", rateQuery.error);
    setMessage({ type: 'error', text: t('quickLog.messages.fetchRateError', { currency }) });
  }

  const exchangeRate = currency === homeCurrency
    ? 1.0
    : isManual ? manualRate!.rate : rateQuery.data ?? 1.0;

  const setCurrency = (next: string) => {
    setCurrencyState(next);
    if (next === homeCurrency) setManualRate(null);
  };

  const handleRateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setManualRate({ currency, rate: isNaN(val) ? 0 : val });
  };

  /** After a save: the next entry fetches its own rate again. */
  const clearManualRate = () => setManualRate(null);

  return {
    currency, setCurrency, exchangeRate,
    isFetchingRate: currency !== homeCurrency && !isManual && rateQuery.isFetching,
    handleRateChange, clearManualRate,
  };
}

export type ExchangeRateState = ReturnType<typeof useExchangeRate>;
