// src/pages/DashboardPage.tsx
import { JSX, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useVehicles } from '../data/vehicleHooks';
import { useLogsSince } from '../data/logHooks';
import { useLifetimeStats, useVehicleComparison } from '../data/statsHooks';
import { buildTrendChartData, windowStart } from '../data/stats';
import { COMMON_CURRENCIES } from '../utils/currencyApi';
import MonthSummary from '../components/dashboard/MonthSummary';
import LifetimeStatsCards from '../components/dashboard/LifetimeStatsCards';
import TrendCharts from '../components/dashboard/TrendCharts';
import VehicleComparisonChart from '../components/dashboard/VehicleComparisonChart';
import type { Log, Vehicle } from '../utils/types';

const MONTHS_BACK = 6;
const NO_LOGS: Log[] = [];
const NO_VEHICLES: Vehicle[] = [];

function DashboardPage(): JSX.Element {
    const { user, profile } = useAuth();
    const { theme } = useTheme();
    const { t } = useTranslation();
    const uid = user?.uid;

    const homeCurrency = profile?.homeCurrency || 'EUR';
    const currencySymbol = COMMON_CURRENCIES.find(c => c.code === homeCurrency)?.symbol || homeCurrency;

    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    // Fixed for the page's lifetime so the query key stays stable.
    const since = useMemo(() => windowStart(MONTHS_BACK), []);

    const vehiclesQuery = useVehicles(uid);
    const logsQuery = useLogsSince(uid, since, selectedVehicleId || undefined);
    const lifetimeQuery = useLifetimeStats(uid, selectedVehicleId || undefined);
    const vehicles = vehiclesQuery.data ?? NO_VEHICLES;
    const comparisonQuery = useVehicleComparison(uid, vehicles);

    const logs = logsQuery.data ?? NO_LOGS;
    const trendChartData = useMemo(() => buildTrendChartData(logs), [logs]);
    const comparison = vehicles.length >= 2 ? comparisonQuery.data ?? [] : [];

    if (!!uid && logsQuery.isPending) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-gray-700 border-t-brand-primary mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500 animate-pulse">{t('dashboard.loading', { defaultValue: 'Loading dashboard...' })}</p>
            </div>
        );
    }

    if (logsQuery.isError || vehiclesQuery.isError) {
        return (
            <div className="text-center py-10 px-4">
                <p className="text-red-600 bg-red-100 p-4 rounded-md">
                    {!navigator.onLine
                        ? t('dashboard.offlineError', { defaultValue: 'You are offline. Please check your connection and try again.' })
                        : t('dashboard.loadError', { defaultValue: 'Failed to load dashboard data. Please try again.' })}
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-3xl px-4 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-2xl font-medium tracking-tight text-gray-900 dark:text-gray-100">{t('dashboard.title', { defaultValue: 'Dashboard' })}</h2>

                {vehicles.length > 1 && (
                    <div className="w-full sm:w-56">
                        <label htmlFor="dashboard-vehicle" className="sr-only">{t('dashboard.fields.vehicle', { defaultValue: 'Vehicle' })}</label>
                        <select
                            id="dashboard-vehicle"
                            value={selectedVehicleId}
                            onChange={(e) => setSelectedVehicleId(e.target.value)}
                            className="nocturne-input cursor-pointer"
                        >
                            <option value="">{t('dashboard.fields.allVehicles', { defaultValue: 'All Vehicles' })}</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.name} ({v.make})</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {logs.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 rounded-xl p-8 text-center space-y-2">
                    <p className="text-gray-700 dark:text-gray-300 font-medium">{t('dashboard.emptyState.heading', { defaultValue: 'No fuel logs yet' })}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{t('dashboard.emptyState.subtext', { defaultValue: 'Log your first fill-up to see your spending summary here.' })}</p>
                </div>
            ) : (
                <>
                    <MonthSummary logs={logs} monthsBack={MONTHS_BACK} currencySymbol={currencySymbol} theme={theme} />
                    {lifetimeQuery.data && <LifetimeStatsCards stats={lifetimeQuery.data} currencySymbol={currencySymbol} />}
                    {trendChartData.length > 1 && <TrendCharts data={trendChartData} currencySymbol={currencySymbol} theme={theme} />}
                    {comparison.length >= 2 && <VehicleComparisonChart data={comparison} currencySymbol={currencySymbol} theme={theme} />}
                </>
            )}
        </div>
    );
}

export default DashboardPage;
