// Home currency, monthly budget and language preferences.
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Settings, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { COMMON_CURRENCIES } from '../../utils/currencyApi';
import LanguageSelector from '../LanguageSelector';

export default function AppPreferencesSection(): JSX.Element {
  const { profile, updateProfile } = useAuth();
  const { t } = useTranslation();
  // Seed the budget input from the loaded profile (0/unset renders as an empty
  // field), and re-seed whenever the stored budget changes.
  const savedBudget = profile?.monthlyBudget;
  const [budgetInput, setBudgetInput] = useState<string>(savedBudget ? String(savedBudget) : '');
  const [seededFrom, setSeededFrom] = useState(savedBudget);
  if (seededFrom !== savedBudget) {
    setSeededFrom(savedBudget);
    setBudgetInput(savedBudget ? String(savedBudget) : '');
  }

  const handleBudgetBlur = () => {
    const parsed = parseFloat(budgetInput);
    const monthlyBudget = !isNaN(parsed) && parsed > 0 ? parsed : 0;
    if (monthlyBudget !== (profile?.monthlyBudget ?? 0)) {
      updateProfile({ monthlyBudget });
    }
  };

  return (
    <div className="nocturne-card rounded-2xl p-6 sm:p-8">
      <div className="flex items-center space-x-3 mb-8">
        <div className="bg-brand-primary/10 p-2 rounded-lg text-brand-primary">
          <Settings size={20} />
        </div>
        <h3 className="text-xl font-medium tracking-tight">{t('profile.appPreferences')}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-brand-primary">
            <Coins size={18} />
            <h4 className="text-xs font-medium uppercase tracking-wider">{t('profile.homeCurrency')}</h4>
          </div>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            {t('profile.homeCurrencyDesc')}
          </p>
          <select
            value={profile?.homeCurrency || 'EUR'}
            onChange={(e) => updateProfile({ homeCurrency: e.target.value })}
            className="nocturne-input"
          >
            {COMMON_CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.code} ({curr.symbol}) - {curr.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-brand-primary">
            <Wallet size={18} />
            <h4 className="text-xs font-medium uppercase tracking-wider">{t('profile.monthlyBudget')}</h4>
          </div>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            {t('profile.monthlyBudgetDesc')}
          </p>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onBlur={handleBudgetBlur}
            placeholder={t('profile.monthlyBudgetPlaceholder')}
            className="nocturne-input"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-brand-primary">
            <Settings size={18} />
            <h4 className="text-xs font-medium uppercase tracking-wider">{t('language.label')}</h4>
          </div>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            {t('language.en')} / {t('language.ga')}
          </p>
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
            <LanguageSelector />
          </div>
        </div>
      </div>

      <div className="mt-8 opacity-40 grayscale pointer-events-none">
        <div className="flex items-center space-x-2 text-gray-400">
          <Settings size={18} />
          <h4 className="text-xs font-medium uppercase tracking-wider">{t('profile.measurementUnits')}</h4>
        </div>
        <p className="text-xs text-gray-400 font-medium mt-4 italic">{t('profile.measurementUnitsSoon')}</p>
      </div>
    </div>
  );
}
