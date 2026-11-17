// MPG / price trend and cost-per-litre trend line charts.
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ChartDataPoint } from '../../utils/types';
import { chartStyles, fmtNum } from './chartStyles';

interface Props {
  data: ChartDataPoint[];
  currencySymbol: string;
  theme: string;
}

export default function TrendCharts({ data, currencySymbol, theme }: Props): JSX.Element {
  const { t } = useTranslation();
  const styles = chartStyles(theme);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggleSeries = (dataKey: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey); else next.add(dataKey);
      return next;
    });
  };
  const axisLabelStyle = { fontSize: '12px', fill: styles.tickFill };
  const priceLabel = t('history.charts.pricePerLitre');

  return (
    <>
      <div className="nocturne-card p-4 sm:p-6">
        <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-4">{t('history.charts.mpgOverTime')}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={styles.gridStroke} />
            <XAxis dataKey="date" tick={styles.tick} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={styles.tick} domain={['auto', 'auto']} label={{ value: 'MPG (UK)', angle: -90, position: 'insideLeft', offset: 10, style: axisLabelStyle }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={styles.tick}
              domain={['auto', 'auto']}
              tickFormatter={(value: number) => value.toFixed(3)}
              label={{ value: `${priceLabel} (${currencySymbol})`, angle: 90, position: 'insideRight', offset: 10, style: axisLabelStyle }}
            />
            <Tooltip
              contentStyle={styles.tooltip}
              formatter={(value, name) => name === priceLabel
                ? `${currencySymbol}${fmtNum(value, 3)}`
                : fmtNum(value, 2)}
            />
            <Legend wrapperStyle={{ ...styles.legend, cursor: 'pointer' }} onClick={(e) => toggleSeries(e.dataKey as string)} />
            <Line yAxisId="left" type="monotone" dataKey="mpg" name="MPG (UK)" stroke="var(--color-brand-primary)" strokeWidth={2.5} activeDot={{ r: 6 }} connectNulls hide={hidden.has('mpg')} />
            <Line yAxisId="right" type="monotone" dataKey="fuelPrice" name={priceLabel} stroke="var(--color-gray-500)" strokeWidth={2} activeDot={{ r: 6 }} connectNulls hide={hidden.has('fuelPrice')} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="nocturne-card p-4 sm:p-6">
        <h3 className="text-base font-medium text-gray-800 dark:text-gray-200 mb-4">{t('history.charts.costPerLitreOverTime')}</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={styles.gridStroke} />
            <XAxis dataKey="date" tick={styles.tick} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
            <YAxis
              tick={styles.tick}
              domain={['auto', 'auto']}
              label={{ value: 'Cost Per Litre (€)', angle: -90, position: 'insideLeft', offset: 10, style: axisLabelStyle }}
              tickFormatter={(value) => value.toFixed(3)}
            />
            <Tooltip contentStyle={styles.tooltip} formatter={(value) => `${currencySymbol}${fmtNum(value, 3)}`} />
            <Legend wrapperStyle={styles.legend} />
            <Line type="monotone" dataKey="fuelPrice" name="Cost Per Litre" stroke="var(--color-brand-primary)" strokeWidth={2.5} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
