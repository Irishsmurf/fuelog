// src/components/StationTable.tsx
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Station } from '../utils/types';
import { ChevronUp, ChevronDown } from 'lucide-react'; // Icons for sorting

interface StationTableProps {
  stations: Station[];
  onSelectStation: (stationId: string) => void;
  selectedStationId: string | null;
}

type SortKey = keyof Station | 'pricePerLiter'; // Add 'pricePerLiter' for calculated value
type SortDirection = 'asc' | 'desc';

const StationTable: React.FC<StationTableProps> = ({ stations, onSelectStation, selectedStationId }) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const sortedStations = useMemo(() => {
    let sortableStations = [...stations];
    if (sortConfig !== null) {
      sortableStations.sort((a, b) => {
        let aValue: string | number | undefined;
        let bValue: string | number | undefined;

        if (sortConfig.key === 'pricePerLiter') {
          aValue = a.avgPrice; // Using avgPrice for sorting
          bValue = b.avgPrice; // Using avgPrice for sorting
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

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
    return sortableStations;
  }, [stations, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    if (sortConfig.direction === 'asc') {
      return <ChevronUp className="w-4 h-4 ml-1 inline" />;
    }
    return <ChevronDown className="w-4 h-4 ml-1 inline" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('name')}
              >
                {t('stationTable.name')} {getSortIcon('name')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('brand')}
              >
                {t('stationTable.brand')} {getSortIcon('brand')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('avgPrice')}
              >
                {t('stationTable.avgPrice')} {getSortIcon('avgPrice')}
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('logCount')}
              >
                {t('stationTable.logCount')} {getSortIcon('logCount')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedStations.map((station) => (
              <tr
                key={station.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                  selectedStationId === station.id ? 'bg-indigo-50 dark:bg-indigo-900' : ''
                }`}
                onClick={() => onSelectStation(station.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {station.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {station.brand || t('stationTable.unknownBrand')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {station.avgPrice ? `€${station.avgPrice.toFixed(3)}/L` : t('stationTable.noData')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                  {station.logCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StationTable;
