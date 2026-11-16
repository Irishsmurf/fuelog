import { useAuth } from '../context/AuthContext';
import { COMMON_CURRENCIES } from '../utils/currencyApi';

/** The signed-in user's home currency code and display symbol. */
export function useHomeCurrency(): { code: string; symbol: string } {
  const { profile } = useAuth();
  const code = profile?.homeCurrency || 'EUR';
  return { code, symbol: COMMON_CURRENCIES.find(c => c.code === code)?.symbol || code };
}
