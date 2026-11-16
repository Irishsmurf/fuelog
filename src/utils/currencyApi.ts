/**
 * Currency API Utility using the Frankfurter API (https://www.frankfurter.app/)
 */

const BASE_URL = 'https://api.frankfurter.app';

interface ExchangeRateResponse {
  amount: number;
  base: string;
  date: string;
  rates: {
    [key: string]: number;
  };
}

/**
 * Fetches the exchange rate for a given date.
 * Returns 1 Transaction Currency = X Home Currency.
 * Example: 1 GBP = 1.17 EUR
 */
/** Local calendar date as YYYY-MM-DD. */
export const toLocalYmd = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const fetchExchangeRate = async (
  date: Date,
  fromCurrency: string,
  toCurrency: string = 'EUR'
): Promise<number> => {
  if (fromCurrency === toCurrency) return 1.0;

  // Frankfurter uses YYYY-MM-DD. Use the *local* calendar date: toISOString()
  // is UTC, so an evening fill-up east of UTC got the next day's rate.
  const formattedDate = toLocalYmd(date);
  
  try {
    const response = await fetch(`${BASE_URL}/${formattedDate}?from=${fromCurrency}&to=${toCurrency}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Failed to fetch exchange rate (${response.status})`);
    }

    const data: ExchangeRateResponse = await response.json();
    const rate = data.rates[toCurrency];

    if (!rate) {
        throw new Error(`Rate for ${toCurrency} not found in API response.`);
    }

    return rate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    throw error;
  }
};

/**
 * Common currencies for the picker.
 */
export const COMMON_CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'CHF', symbol: 'Fr.', name: 'Swiss Franc' },
];
