// Multi-vehicle efficiency/cost comparison bar chart.
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { VehicleComparisonDatum } from '../../data/stats';
import { chartStyles, fmtNum } from './chartStyles';

interface Props {
  data: VehicleComparisonDatum[];
  currencySymbol: string;
  theme: string;
}

export default function VehicleComparisonChart({ data, currencySymbol, theme }: Props): JSX.Element {
  const { t } = useTranslation();
  const styles = chartStyles(theme);
  const totalSpend = t('history.charts.totalSpend');
  const avgCostPerLitre = t('history.charts.avgCostPerLitre');

  return (
    <div className="nocturne-card p-4 sm:p-6">
      <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-4">{t('history.charts.vehicleComparison')}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={styles.gridStroke} />
          <XAxis dataKey="name" tick={styles.tick} />
          <YAxis yAxisId="left" tick={styles.tick} />
          <YAxis yAxisId="right" orientation="right" tick={styles.tick} />
          <Tooltip
            contentStyle={styles.tooltip}
            formatter={(value, name) => name === totalSpend
              ? `${currencySymbol}${fmtNum(value, 2)}`
              : name === avgCostPerLitre
                ? `${currencySymbol}${fmtNum(value, 3)}`
                : fmtNum(value, 2)}
          />
          <Legend wrapperStyle={styles.legend} />
          <Bar yAxisId="left" dataKey="avgL100km" name={t('history.charts.avgL100km')} fill="var(--color-brand-primary)" />
          <Bar yAxisId="left" dataKey="avgCostPerLitre" name={avgCostPerLitre} fill="var(--color-gray-600)" />
          <Bar yAxisId="right" dataKey="totalSpend" name={totalSpend} fill="var(--color-amber-700)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
