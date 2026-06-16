// src/pages/DashboardPage.tsx
import { JSX, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Banknote, Droplets, Gauge, Route, Fuel } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useRemoteConfig } from '../context/RemoteConfigContext';
import { getLifetimeStats, LifetimeStats } from '../firebase/aggregationService';
import { Log, FuelLogData, Vehicle, ChartDataPoint } from '../utils/types';
import { getMonthlyTotals, getNumericFuelPrice, getNumericMPG } from '../utils/calculations';
import { COMMON_CURRENCIES } from '../utils/currencyApi';
import { formatDate } from '../utils/formatDate';

interface VehicleComparisonDatum {
    vehicleId: string;
    name: string;
    avgL100km: number;
    avgCostPerLitre: number;
    totalSpend: number;
}

const MONTHS_BACK = 6;

function DashboardPage(): JSX.Element {
    const { user, profile } = useAuth();
    const { theme } = useTheme();
    const { t } = useTranslation();

    const { getBoolean } = useRemoteConfig();

    const homeCurrency = profile?.homeCurrency || 'EUR';
    const homeCurrencySymbol = COMMON_CURRENCIES.find(c => c.code === homeCurrency)?.symbol || homeCurrency;

    const costPerLitreGraphEnabled = getBoolean("costPerLitreGraphEnabled");
    const vehicleComparisonEnabled = getBoolean("vehicleComparisonEnabled");

    const [logs, setLogs] = useState<Log[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats | null>(null);
    const [vehicleComparisonStats, setVehicleComparisonStats] = useState<VehicleComparisonDatum[]>([]);
    const [hiddenChartSeries, setHiddenChartSeries] = useState<Set<string>>(new Set());
    const toggleChartSeries = (dataKey: string) => {
        setHiddenChartSeries(prev => {
            const next = new Set(prev);
            if (next.has(dataKey)) next.delete(dataKey); else next.add(dataKey);
            return next;
        });
    };

    useEffect(() => {
        if (!user) { setVehicles([]); return; }
        let cancelled = false;

        const fetchVehicles = async () => {
            try {
                const q = query(collection(db, 'vehicles'), where('userId', '==', user.uid));
                const snap = await getDocs(q);
                if (cancelled) return;
                const list: Vehicle[] = [];
                snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Vehicle));
                setVehicles(list.filter(v => !v.isArchived));
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching vehicles:', err);
                setError(
                    !navigator.onLine
                        ? t('dashboard.offlineError', { defaultValue: 'You are offline. Please check your connection and try again.' })
                        : t('dashboard.loadError', { defaultValue: 'Failed to load dashboard data. Please try again.' })
                );
            }
        };
        fetchVehicles();

        return () => { cancelled = true; };
    }, [user, t]);

    useEffect(() => {
        if (!user) { setIsLoading(false); setLogs([]); return; }
        setIsLoading(true);
        setError(null);
        let cancelled = false;

        const fetchLogs = async () => {
            try {
                const windowStart = new Date(new Date().getFullYear(), new Date().getMonth() - (MONTHS_BACK - 1), 1);
                const constraints = [
                    where('userId', '==', user.uid),
                    where('timestamp', '>=', Timestamp.fromDate(windowStart)),
                ];
                if (selectedVehicleId) constraints.push(where('vehicleId', '==', selectedVehicleId));
                const q = query(collection(db, 'fuelLogs'), ...constraints);
                const snap = await getDocs(q);
                if (cancelled) return;
                const list: Log[] = [];
                snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as FuelLogData) }));
                setLogs(list);
            } catch (err) {
                if (cancelled) return;
                console.error('Error fetching logs for dashboard:', err);
                setError(
                    !navigator.onLine
                        ? t('dashboard.offlineError', { defaultValue: 'You are offline. Please check your connection and try again.' })
                        : t('dashboard.loadError', { defaultValue: 'Failed to load dashboard data. Please try again.' })
                );
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchLogs();

        return () => { cancelled = true; };
    }, [user, selectedVehicleId, t]);

    useEffect(() => {
        if (!user) { setLifetimeStats(null); return; }
        getLifetimeStats(user.uid, selectedVehicleId || undefined)
            .then(setLifetimeStats)
            .catch(err => console.error('Error fetching lifetime stats:', err));
    }, [user, selectedVehicleId]);

    useEffect(() => {
        if (!user || !vehicleComparisonEnabled) { setVehicleComparisonStats([]); return; }
        if (vehicles.length < 2) { setVehicleComparisonStats([]); return; }

        let cancelled = false;
        Promise.all(
            vehicles.map(vehicle =>
                getLifetimeStats(user.uid, vehicle.id).then(stats => ({ vehicle, stats }))
            )
        )
            .then(results => {
                if (cancelled) return;
                const withLogs = results.filter(({ stats }) => stats.logCount > 0);
                if (withLogs.length < 2) { setVehicleComparisonStats([]); return; }
                setVehicleComparisonStats(withLogs.map(({ vehicle, stats }) => ({
                    vehicleId: vehicle.id,
                    name: vehicle.name,
                    avgL100km: stats.totalDistanceKm > 0 ? (stats.totalLitres / stats.totalDistanceKm) * 100 : 0,
                    avgCostPerLitre: stats.totalLitres > 0 ? stats.totalCost / stats.totalLitres : 0,
                    totalSpend: stats.totalCost,
                })));
            })
            .catch(err => console.error('Error fetching vehicle comparison stats:', err));

        return () => { cancelled = true; };
    }, [user, vehicles, vehicleComparisonEnabled]);

    const monthlyTotals = useMemo(() => getMonthlyTotals(logs, MONTHS_BACK), [logs]);

    const trendChartData = useMemo((): ChartDataPoint[] => {
        if (!logs || logs.length === 0) return [];
        const sortedLogs = [...logs].sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
        return sortedLogs.map(log => ({
            date: log.timestamp?.toDate() ? formatDate(log.timestamp.toDate()) : 'N/A',
            timestampValue: log.timestamp?.toMillis(),
            mpg: getNumericMPG(log.distanceKm, log.fuelAmountLiters),
            cost: log.cost > 0 ? log.cost : null,
            fuelPrice: getNumericFuelPrice(log.cost, log.fuelAmountLiters)
        }));
    }, [logs]);

    const monthFormatter = useMemo(
        () => new Intl.DateTimeFormat(undefined, { month: 'short' }),
        []
    );

    const chartData = useMemo(
        () => monthlyTotals.map(m => ({
            month: monthFormatter.format(m.monthStart),
            cost: Math.round(m.totalCost * 100) / 100,
        })),
        [monthlyTotals, monthFormatter]
    );

    const currentMonth = monthlyTotals[monthlyTotals.length - 1];
    const currentMonthAvgPrice = currentMonth ? getNumericFuelPrice(currentMonth.totalCost, currentMonth.totalLitres) : null;

    if (isLoading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500 animate-pulse">{t('dashboard.loading', { defaultValue: 'Loading dashboard...' })}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-10 px-4">
                <p className="text-red-600 bg-red-100 p-4 rounded-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-3xl px-4 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('dashboard.title', { defaultValue: 'Dashboard' })}</h2>

                {vehicles.length > 1 && (
                    <div className="w-full sm:w-56">
                        <label htmlFor="dashboard-vehicle" className="sr-only">{t('dashboard.fields.vehicle', { defaultValue: 'Vehicle' })}</label>
                        <select
                            id="dashboard-vehicle"
                            value={selectedVehicleId}
                            onChange={(e) => setSelectedVehicleId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center gap-2">
                            <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                                <Banknote size={18} />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">{t('dashboard.cards.monthSpend', { defaultValue: 'This Month' })}</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">
                                {homeCurrencySymbol}{(currentMonth?.totalCost ?? 0).toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center gap-2">
                            <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                                <Droplets size={18} />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">{t('dashboard.cards.monthLitres', { defaultValue: 'Litres This Month' })}</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">
                                {(currentMonth?.totalLitres ?? 0).toFixed(1)}L
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center gap-2">
                            <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                                <Gauge size={18} />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">{t('dashboard.cards.avgPrice', { defaultValue: 'Avg Price/Litre' })}</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">
                                {currentMonthAvgPrice !== null ? `${homeCurrencySymbol}${currentMonthAvgPrice.toFixed(3)}` : 'N/A'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">{t('dashboard.charts.monthlySpend', { defaultValue: 'Monthly Spend (Last 6 Months)' })}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4A5568' : '#e0e0e0'} />
                                <XAxis dataKey="month" tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }} />
                                <YAxis tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        fontSize: '12px',
                                        padding: '5px',
                                        backgroundColor: theme === 'dark' ? '#2D3748' : 'white',
                                        color: theme === 'dark' ? 'white' : 'black',
                                        border: theme === 'dark' ? '1px solid #4A5568' : '1px solid #e0e0e0'
                                    }}
                                    formatter={(value: number) => `${homeCurrencySymbol}${value.toFixed(2)}`}
                                />
                                <Bar dataKey="cost" name={t('dashboard.charts.spend', { defaultValue: 'Spend' })} fill="#8884d8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* --- Lifetime Stats (Server-side aggregation, no full data download) --- */}
                    {lifetimeStats && (
                        <div>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                {t('history.lifetimeStats.heading', { defaultValue: 'Lifetime Totals' })}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all duration-200">
                                    <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                                        <Banknote size={18} />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">{t('history.lifetimeStats.totalSpent', { defaultValue: 'Total Spent' })}</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">{homeCurrencySymbol}{lifetimeStats.totalCost.toFixed(2)}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all duration-200">
                                    <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                                        <Droplets size={18} />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">{t('history.lifetimeStats.totalLitres', { defaultValue: 'Total Litres' })}</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">{lifetimeStats.totalLitres.toFixed(1)}L</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all duration-200">
                                    <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                                        <Route size={18} />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">{t('history.lifetimeStats.totalDistance', { defaultValue: 'Total Distance' })}</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">{lifetimeStats.totalDistanceKm.toFixed(0)}km</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-all duration-200">
                                    <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                                        <Fuel size={18} />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">{t('history.lifetimeStats.logCount', { defaultValue: 'Fill-ups' })}</p>
                                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tighter">{lifetimeStats.logCount}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- MPG / Price Trend Chart --- */}
                    {trendChartData.length > 1 && (
                        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">{t('history.charts.mpgOverTime')}</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4A5568' : '#e0e0e0'} />
                                    <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
                                    <YAxis yAxisId="left" tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }} domain={['auto', 'auto']} label={{ value: 'MPG (UK)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '12px', fill: theme === 'dark' ? '#cbd5e0' : '#6b7280' } }} />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }}
                                        domain={['auto', 'auto']}
                                        tickFormatter={(value: number) => value.toFixed(3)}
                                        label={{ value: `${t('history.charts.pricePerLitre')} (${homeCurrencySymbol})`, angle: 90, position: 'insideRight', offset: 10, style: { fontSize: '12px', fill: theme === 'dark' ? '#cbd5e0' : '#6b7280' } }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            fontSize: '12px',
                                            padding: '5px',
                                            backgroundColor: theme === 'dark' ? '#2D3748' : 'white',
                                            color: theme === 'dark' ? 'white' : 'black',
                                            border: theme === 'dark' ? '1px solid #4A5568' : '1px solid #e0e0e0'
                                        }}
                                        formatter={(value: number, name: string) => name === t('history.charts.pricePerLitre')
                                            ? `${homeCurrencySymbol}${value.toFixed(3)}`
                                            : value?.toFixed(2)}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: theme === 'dark' ? 'white' : 'black', cursor: 'pointer' }}
                                        onClick={(e) => toggleChartSeries(e.dataKey as string)}
                                    />
                                    <Line yAxisId="left" type="monotone" dataKey="mpg" name="MPG (UK)" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} connectNulls hide={hiddenChartSeries.has('mpg')} />
                                    <Line yAxisId="right" type="monotone" dataKey="fuelPrice" name={t('history.charts.pricePerLitre')} stroke="#F59E0B" strokeWidth={2} activeDot={{ r: 6 }} connectNulls hide={hiddenChartSeries.has('fuelPrice')} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Conditionally render Cost Per Litre Graph if feature flag is enabled and data exists */}
                    {costPerLitreGraphEnabled && trendChartData.length > 1 && (
                        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">{t('history.charts.costPerLitreOverTime')}</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4A5568' : '#e0e0e0'} />
                                    <XAxis dataKey="date" tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
                                    <YAxis
                                        tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }}
                                        domain={['auto', 'auto']}
                                        label={{ value: 'Cost Per Litre (€)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '12px', fill: theme === 'dark' ? '#cbd5e0' : '#6b7280' } }}
                                        tickFormatter={(value) => value.toFixed(3)}
                                    />
                                    <Tooltip
                                        contentStyle={{ fontSize: '12px', padding: '5px', backgroundColor: theme === 'dark' ? '#2D3748' : 'white', color: theme === 'dark' ? 'white' : 'black', border: theme === 'dark' ? '1px solid #4A5568' : '1px solid #e0e0e0' }}
                                        formatter={(value: number) => `€${value.toFixed(3)}`}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: theme === 'dark' ? 'white' : 'black' }} />
                                    <Line type="monotone" dataKey="fuelPrice" name="Cost Per Litre" stroke="#82ca9d" strokeWidth={2} activeDot={{ r: 6 }} connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Multi-vehicle efficiency/cost comparison, behind vehicleComparisonEnabled flag */}
                    {vehicleComparisonEnabled && vehicleComparisonStats.length >= 2 && (
                        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">{t('history.charts.vehicleComparison')}</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={vehicleComparisonStats} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4A5568' : '#e0e0e0'} />
                                    <XAxis dataKey="name" tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }} />
                                    <YAxis
                                        yAxisId="left"
                                        tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }}
                                    />
                                    <YAxis
                                        yAxisId="right"
                                        orientation="right"
                                        tick={{ fill: theme === 'dark' ? '#cbd5e0' : '#6b7280', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ fontSize: '12px', padding: '5px', backgroundColor: theme === 'dark' ? '#2D3748' : 'white', color: theme === 'dark' ? 'white' : 'black', border: theme === 'dark' ? '1px solid #4A5568' : '1px solid #e0e0e0' }}
                                        formatter={(value: number, name: string) => name === t('history.charts.totalSpend')
                                            ? `${homeCurrencySymbol}${value.toFixed(2)}`
                                            : name === t('history.charts.avgCostPerLitre')
                                                ? `${homeCurrencySymbol}${value.toFixed(3)}`
                                                : value.toFixed(2)}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: theme === 'dark' ? 'white' : 'black' }} />
                                    <Bar yAxisId="left" dataKey="avgL100km" name={t('history.charts.avgL100km')} fill="#8884d8" />
                                    <Bar yAxisId="left" dataKey="avgCostPerLitre" name={t('history.charts.avgCostPerLitre')} fill="#82ca9d" />
                                    <Bar yAxisId="right" dataKey="totalSpend" name={t('history.charts.totalSpend')} fill="#fbbf24" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default DashboardPage;
