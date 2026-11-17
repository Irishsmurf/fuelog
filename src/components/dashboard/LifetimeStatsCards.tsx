// Lifetime totals (server-side aggregation, no full data download).
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { LifetimeStats } from '../../data/stats';
import StatCard from './StatCard';

export default function LifetimeStatsCards({ stats, currencySymbol }: { stats: LifetimeStats; currencySymbol: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {t('history.lifetimeStats.heading', { defaultValue: 'Lifetime Totals' })}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t('history.lifetimeStats.totalSpent', { defaultValue: 'Total Spent' })}>{currencySymbol}{stats.totalCost.toFixed(2)}</StatCard>
        <StatCard label={t('history.lifetimeStats.totalLitres', { defaultValue: 'Total Litres' })}>{stats.totalLitres.toFixed(1)}L</StatCard>
        <StatCard label={t('history.lifetimeStats.totalDistance', { defaultValue: 'Total Distance' })}>{stats.totalDistanceKm.toFixed(0)}km</StatCard>
        <StatCard label={t('history.lifetimeStats.logCount', { defaultValue: 'Fill-ups' })}>{stats.logCount}</StatCard>
      </div>
    </div>
  );
}
