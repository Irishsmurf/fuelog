// src/components/StationTable.tsx
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Station } from '../utils/types';

interface StationTableProps {
  stations: Station[];
  onSelectStation: (stationId: string) => void;
  selectedStationId: string | null;
}

type SortKey = 'name' | 'avgPrice' | 'logCount';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; labelKey: string }[] = [
  { key: 'name', labelKey: 'stationTable.name' },
  { key: 'avgPrice', labelKey: 'stationTable.avgPrice' },
  { key: 'logCount', labelKey: 'stationTable.logCount' },
];

// A station's price tier (relative to the other visible stations) is the signature
// of this list: it lets a user spot the cheapest fill-up at a glance instead of
// having to scan every row's price, which is the whole point of comparing stations.
type PriceTier = 'cheapest' | 'average' | 'priciest';

const TIER_STYLES: Record<PriceTier, string> = {
  cheapest: 'bg-brand-success',
  average: 'bg-brand-primary',
  priciest: 'bg-brand-danger',
};

const usePriceTiers = (stations: Station[]): Map<string, PriceTier> => {
  return useMemo(() => {
    const priced = stations
      .filter((s): s is Station & { avgPrice: number } => typeof s.avgPrice === 'number')
      .map((s) => s.avgPrice)
      .sort((a, b) => a - b);

    const tiers = new Map<string, PriceTier>();
    if (priced.length < 2) {
      stations.forEach((s) => {
        if (typeof s.avgPrice === 'number') tiers.set(s.id, 'average');
      });
      return tiers;
    }

    const lowCut = priced[Math.floor((priced.length - 1) / 3)];
    const highCut = priced[Math.ceil((priced.length - 1) * (2 / 3))];

    stations.forEach((s) => {
      if (typeof s.avgPrice !== 'number') return;
      if (s.avgPrice <= lowCut) tiers.set(s.id, 'cheapest');
      else if (s.avgPrice >= highCut) tiers.set(s.id, 'priciest');
      else tiers.set(s.id, 'average');
    });
    return tiers;
  }, [stations]);
};

const StationTable: React.FC<StationTableProps> = ({ stations, onSelectStation, selectedStationId }) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const priceTiers = usePriceTiers(stations);

  const sortedStations = useMemo(() => {
    const sortable = [...stations];
    if (sortConfig !== null) {
      sortable.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || aValue === null) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === undefined || bValue === null) return sortConfig.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
    }
    return sortable;
  }, [stations, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortIconFor = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
      : <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">
          {t('stationTable.sortBy')}
        </span>
        {SORT_OPTIONS.map(({ key, labelKey }) => {
          const isActive = sortConfig?.key === key;
          return (
            <button
              key={key}
              type="button"
              data-testid={`sort-${key}`}
              onClick={() => requestSort(key)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-brand-primary text-gray-950'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t(labelKey)}
              {sortIconFor(key)}
            </button>
          );
        })}
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {sortedStations.map((station) => {
          const isSelected = selectedStationId === station.id;
          const tier = priceTiers.get(station.id);
          return (
            <li key={station.id}>
              <button
                type="button"
                onClick={() => onSelectStation(station.id)}
                aria-current={isSelected ? 'true' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  isSelected ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                }`}
              >
                <span
                  className={`w-1.5 h-10 rounded-full shrink-0 ${tier ? TIER_STYLES[tier] : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-900 dark:text-gray-100 truncate">
                    {station.name}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                    {station.brand || t('stationTable.unknownBrand')} · {station.logCount} {t('stationTable.logCount')}
                  </span>
                </span>
                <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 shrink-0 whitespace-nowrap">
                  {station.avgPrice ? `€${station.avgPrice.toFixed(3)}/L` : t('stationTable.noData')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default StationTable;
