// Shared Recharts styling for the dashboard charts.
import type { CSSProperties } from 'react';

/** Recharts 3 types tooltip values as possibly undefined or non-numeric. */
export const fmtNum = (value: unknown, digits: number): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '';

export interface ChartStyles {
  gridStroke: string;
  tickFill: string;
  tick: { fill: string; fontSize: number };
  tooltip: CSSProperties;
  legend: CSSProperties;
}

export function chartStyles(theme: string): ChartStyles {
  const dark = theme === 'dark';
  const tickFill = dark ? 'var(--color-gray-500)' : 'var(--color-gray-600)';
  return {
    gridStroke: dark ? 'var(--color-gray-700)' : 'var(--color-gray-200)',
    tickFill,
    tick: { fill: tickFill, fontSize: 12 },
    tooltip: {
      fontSize: '12px',
      padding: '5px',
      backgroundColor: dark ? 'var(--color-surface)' : 'white',
      color: dark ? 'white' : 'black',
      border: dark ? '1px solid var(--color-gray-700)' : '1px solid var(--color-gray-200)',
    },
    legend: { fontSize: '12px', paddingTop: '10px', color: dark ? 'white' : 'black' },
  };
}
