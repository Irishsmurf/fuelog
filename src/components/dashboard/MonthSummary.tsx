// This month's cards plus the monthly-spend bar chart.
import { JSX, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getMonthlyTotals, getNumericFuelPrice } from '../../utils/calculations';
import type { Log } from '../../utils/types';
import StatCard from './StatCard';
import { chartStyles, fmtNum } from './chartStyles';

interface Props {
  logs: Log[];
  monthsBack: number;
  currencySymbol: string;
  theme: string;
}

export default function MonthSummary({ logs, monthsBack, currencySymbol, theme }: Props): JSX.Element {
  const { t } = useTranslation();
  const styles = chartStyles(theme);
  const monthlyTotals = useMemo(() => getMonthlyTotals(logs, monthsBack), [logs, monthsBack]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { month: 'short' }), []);
  const chartData = useMemo(
    () => monthlyTotals.map(m => ({
      month: monthFormatter.format(m.monthStart),
      cost: Math.round(m.totalCost * 100) / 100,
    })),
    [monthlyTotals, monthFormatter],
  );

  const currentMonth = monthlyTotals[monthlyTotals.length - 1];
  const avgPrice = currentMonth ? getNumericFuelPrice(currentMonth.totalCost, currentMonth.totalLitres) : null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('dashboard.cards.monthSpend', { defaultValue: 'This Month' })}>
          {currencySymbol}{(currentMonth?.totalCost ?? 0).toFixed(2)}
        </StatCard>
        <StatCard label={t('dashboard.cards.monthLitres', { defaultValue: 'Litres This Month' })}>
          {(currentMonth?.totalLitres ?? 0).toFixed(1)}L
        </StatCard>
        <StatCard label={t('dashboard.cards.avgPrice', { defaultValue: 'Avg Price/Litre' })}>
          {avgPrice !== null ? `${currencySymbol}${avgPrice.toFixed(3)}` : 'N/A'}
        </StatCard>
      </div>

      <div className="nocturne-card p-4 sm:p-6">
        <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-4">{t('dashboard.charts.monthlySpend', { defaultValue: 'Monthly Spend (Last 6 Months)' })}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={styles.gridStroke} />
            <XAxis dataKey="month" tick={styles.tick} />
            <YAxis tick={styles.tick} />
            <Tooltip contentStyle={styles.tooltip} formatter={(value) => `${currencySymbol}${fmtNum(value, 2)}`} />
            <Bar dataKey="cost" name={t('dashboard.charts.spend', { defaultValue: 'Spend' })} fill="var(--color-amber-700)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
