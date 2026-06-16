// src/components/StationDetail.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, AlertCircle, MapPin } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

import { Log, Station } from '../utils/types';
import { fetchFuelLogsByStationId, fetchStationById } from '../firebase/firestoreService';
import { formatDate } from '../utils/formatDate';

const RECENT_LOGS_LIMIT = 12;
const RECENT_LOGS_COLLAPSED_LIMIT = 5;

interface StationDetailProps {
    stationId: string;
}

const StationDetail: React.FC<StationDetailProps> = ({ stationId }) => {
    const { t } = useTranslation();
    const [station, setStation] = useState<Station | null>(null);
    const [fuelLogs, setFuelLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showAllLogs, setShowAllLogs] = useState(false);

    useEffect(() => {
        const loadStationData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch only the most recent fills — used for the price-trend chart and
                // recent-logs list. Lifetime stats (avg/last price, total log count) come
                // from the station document's server-maintained aggregates (updated on every
                // fill via updateStationMetrics), not from this limited log window.
                // allSettled so a transient failure fetching the station doc doesn't discard
                // already-fetched logs (and vice versa) — each result is handled independently.
                const [logsResult, stationResult] = await Promise.allSettled([
                    fetchFuelLogsByStationId(stationId, RECENT_LOGS_LIMIT),
                    fetchStationById(stationId),
                ]);

                if (logsResult.status === 'rejected') throw logsResult.reason;
                const logs = logsResult.value;
                const stationDoc = stationResult.status === 'fulfilled' ? stationResult.value : null;
                if (stationResult.status === 'rejected') {
                    console.error('Failed to load station document:', stationResult.reason);
                }
                setFuelLogs(logs);

                if (stationDoc) {
                    setStation(stationDoc);
                } else if (logs.length > 0) {
                    // Fallback for stations without a stored doc (shouldn't normally happen):
                    // derive lifetime-ish stats from the fetched log window.
                    const firstLog = logs[0];
                    setStation({
                        id: stationId,
                        osmId: '',
                        name: firstLog.brand || 'Unknown Station',
                        brand: firstLog.brand,
                        latitude: firstLog.latitude || 0,
                        longitude: firstLog.longitude || 0,
                        logCount: logs.length,
                        lastPrice: logs[0] && logs[0].fuelAmountLiters && isFinite(logs[0].cost / logs[0].fuelAmountLiters) ? (logs[0].cost / logs[0].fuelAmountLiters) : undefined,
                        avgPrice: logs.length > 0
                            ? (() => {
                                const totalCostPerLiter = logs.reduce((sum, log) => {
                                    const price = log.fuelAmountLiters ? (log.cost / log.fuelAmountLiters) : 0;
                                    return isFinite(price) ? sum + price : sum;
                                }, 0);
                                const validLogsCount = logs.filter(log => log.fuelAmountLiters && isFinite(log.cost / log.fuelAmountLiters)).length;
                                return validLogsCount > 0 ? totalCostPerLiter / validLogsCount : undefined;
                            })()
                            : undefined,
                    });
                } else {
                    setStation(null); // No station doc and no logs — nothing to display
                }

            } catch (err) {
                console.error("Failed to load station details:", err);
                setError(t('stationDetail.errorLoading'));
            } finally {
                setLoading(false);
            }
        };

        loadStationData();
        // t is intentionally excluded below: re-running this fetch on every locale change isn't
        // needed, and including it risks a refetch loop since useTranslation() returns a new t
        // reference on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stationId]);

    const chartData = useMemo(() => {
        return fuelLogs
            .filter(log => log.fuelAmountLiters > 0)
            .map(log => {
                const price = log.fuelAmountLiters ? (log.cost / log.fuelAmountLiters) : 0;
                return {
                    date: formatDate(log.timestamp.toDate()),
                    pricePerLiter: isFinite(price) ? parseFloat(price.toFixed(3)) : 0, // Ensure it's a finite number
                };
            })
            .reverse(); // Display oldest first on chart
    }, [fuelLogs]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                <Loader className="w-8 h-8 animate-spin mb-2" data-testid="loader-icon" />
                <p>{t('stationDetail.loading')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="w-8 h-8 mb-2" data-testid="alert-icon" />
                <p>{error}</p>
            </div>
        );
    }

    if (!station) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                <p>{t('stationDetail.noData')}</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 border border-gray-100 dark:border-gray-700 h-full">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                <MapPin className="w-6 h-6 mr-2 text-brand-primary" />
                {station.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">{station.brand || t('stationDetail.unknownBrand')}</p>

            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('stationDetail.avgPrice')}</p>
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">
                        {station.avgPrice ? `€${station.avgPrice.toFixed(3)}/L` : t('stationDetail.noData')}
                    </p>
                </div>
                <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('stationDetail.lastPrice')}</p>
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">
                        {station.lastPrice ? `€${station.lastPrice.toFixed(3)}/L` : t('stationDetail.noData')}
                    </p>
                </div>
                <div>
                    <p className="text-gray-500 dark:text-gray-400">{t('stationDetail.logCount')}</p>
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">{station.logCount}</p>
                </div>
            </div>

            <h3 id={`price-history-heading-${stationId}`} className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('stationDetail.priceHistory')}</h3>
            {chartData.length > 1 ? (
                <div
                    className="h-64 w-full mb-6"
                    role="img"
                    aria-labelledby={`price-history-heading-${stationId}`}
                    aria-describedby={`price-history-table-${stationId}`}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-gray-700" />
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                className="dark:stroke-gray-400"
                                label={{ value: t('stationDetail.chartAxisDate'), position: 'insideBottom', offset: -5, style: { fontSize: 12, fill: '#888888' } }}
                            />
                            <YAxis
                                stroke="#888888"
                                className="dark:stroke-gray-400"
                                domain={['auto', 'auto']}
                                label={{ value: t('stationDetail.chartAxisPrice'), angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#888888', textAnchor: 'middle' } }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--color-bg-light)', border: 'none', borderRadius: '4px' }}
                                itemStyle={{ color: 'var(--color-text-light)' }}
                            />
                            <Line type="monotone" dataKey="pricePerLiter" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                    {/* Screen-reader-only data table fallback for the chart above */}
                    <table id={`price-history-table-${stationId}`} className="sr-only">
                        <caption>{t('stationDetail.priceHistory')}</caption>
                        <thead>
                            <tr>
                                <th scope="col">{t('stationDetail.chartAxisDate')}</th>
                                <th scope="col">{t('stationDetail.chartAxisPrice')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((point, idx) => (
                                <tr key={idx}>
                                    <td>{point.date}</td>
                                    <td>{point.pricePerLiter.toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 h-64 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 rounded-md mb-6">
                    <p>{t('stationDetail.notEnoughDataForChart')}</p>
                </div>
            )}

            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('stationDetail.recentLogs')}</h3>
            {fuelLogs.length > 0 ? (
                <>
                    <div className="space-y-2">
                        {(showAllLogs ? fuelLogs : fuelLogs.slice(0, RECENT_LOGS_COLLAPSED_LIMIT)).map(log => (
                            <div key={log.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                                <p className="text-sm text-gray-900 dark:text-gray-100">
                                    {formatDate(log.timestamp.toDate())}
                                </p>
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                    €{log.cost.toFixed(2)} ({log.fuelAmountLiters.toFixed(2)}L @ {isFinite(log.cost / log.fuelAmountLiters) ? (log.cost / log.fuelAmountLiters).toFixed(3) : t('stationTable.noData')}/L)
                                </p>
                            </div>
                        ))}
                    </div>
                    {fuelLogs.length > RECENT_LOGS_COLLAPSED_LIMIT && (
                        <button
                            type="button"
                            onClick={() => setShowAllLogs(prev => !prev)}
                            className="mt-3 text-sm font-medium text-brand-primary hover:underline"
                        >
                            {showAllLogs
                                ? t('stationDetail.showFewer')
                                : t('stationDetail.showMore', { count: fuelLogs.length - RECENT_LOGS_COLLAPSED_LIMIT })}
                        </button>
                    )}
                </>
            ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p>{t('stationDetail.noLogsFound')}</p>
                </div>
            )}
        </div>
    );
};

export default StationDetail;
