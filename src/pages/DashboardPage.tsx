// src/pages/DashboardPage.tsx
import { JSX, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Banknote, Droplets, Gauge } from 'lucide-react';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Log, FuelLogData, Vehicle } from '../utils/types';
import { getMonthlyTotals, getNumericFuelPrice } from '../utils/calculations';
import { COMMON_CURRENCIES } from '../utils/currencyApi';

const MONTHS_BACK = 6;

function DashboardPage(): JSX.Element {
    const { user, profile } = useAuth();
    const { theme } = useTheme();
    const { t } = useTranslation();

    const homeCurrency = profile?.homeCurrency || 'EUR';
    const homeCurrencySymbol = COMMON_CURRENCIES.find(c => c.code === homeCurrency)?.symbol || homeCurrency;

    const [logs, setLogs] = useState<Log[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

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

    const monthlyTotals = useMemo(() => getMonthlyTotals(logs, MONTHS_BACK), [logs]);

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
                </>
            )}
        </div>
    );
}

export default DashboardPage;
