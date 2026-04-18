// src/components/StationDetail.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, AlertCircle, MapPin } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

import { Log, Station } from '../utils/types';
import { fetchFuelLogsByStationId } from '../firebase/firestoreService';

interface StationDetailProps {
    stationId: string;
}

const StationDetail: React.FC<StationDetailProps> = ({ stationId }) => {
    const { t } = useTranslation();
    const [station, setStation] = useState<Station | null>(null);
    const [fuelLogs, setFuelLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // This component currently doesn't directly fetch station details,
    // it assumes the parent (StationsPage) already has the list of stations.
    // For a more robust solution, we might want to pass the full station object
    // or fetch it here if we navigate directly to a station detail page.
    // For now, it will look for the station in the overall stations list (passed down via context or prop)

    useEffect(() => {
        const loadStationData = async () => {
            setLoading(true);
            setError(null);
            try {
                // In a real app, you might fetch the single station here if navigating directly
                // For now, assume StationsPage passes the station object or it's in a global state
                // We don't have access to the full `stations` array here, so we will only fetch logs.
                // The `StationsPage` parent component is responsible for knowing the `station` object.
                // A better pattern would be to pass `Station` object itself as a prop.
                
                // For now, let's assume we can fetch the station from parent's state or a dedicated API call if needed.
                // For simplicity, we'll rely on the parent (StationsPage) to provide the full station object
                // if we want to display more than what's available from the logs.
                // Given the current structure, let's just fetch the logs and display the ID for now.
                // The Station object itself could be passed as a prop from StationsPage.

                const logs = await fetchFuelLogsByStationId(stationId);
                setFuelLogs(logs);

                // Simulate fetching station details, as it's not directly fetched by ID here
                // In a real application, you would fetch it from Firestore if it's not passed as a prop.
                // This mock assumes the station data is available in the parent and can be passed down.
                // For now, we will construct a partial station object for display from the logs.
                if (logs.length > 0) {
                    const firstLog = logs[0];
                    setStation({
                        id: stationId,
                        osmId: '', // Not available from log
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
                    setStation(null); // No logs, no station to display
                }

            } catch (err) {
                console.error("Failed to load station details:", err);
                setError(t('stationDetail.errorLoading'));
            } finally {
                setLoading(false);
            }
        };

        loadStationData();
    }, [stationId, t]);

    const chartData = useMemo(() => {
        return fuelLogs
            .filter(log => log.fuelAmountLiters > 0)
            .map(log => {
                const price = log.fuelAmountLiters ? (log.cost / log.fuelAmountLiters) : 0;
                return {
                    date: log.timestamp.toDate().toLocaleDateString(),
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

            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('stationDetail.priceHistory')}</h3>
            {chartData.length > 1 ? (
                <div className="h-64 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" className="dark:stroke-gray-700" />
                            <XAxis dataKey="date" stroke="#888888" className="dark:stroke-gray-400" />
                            <YAxis stroke="#888888" className="dark:stroke-gray-400" domain={['auto', 'auto']} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--color-bg-light)', border: 'none', borderRadius: '4px' }}
                                itemStyle={{ color: 'var(--color-text-light)' }}
                            />
                            <Line type="monotone" dataKey="pricePerLiter" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 h-64 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 rounded-md mb-6">
                    <p>{t('stationDetail.notEnoughDataForChart')}</p>
                </div>
            )}

            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{t('stationDetail.recentLogs')}</h3>
            {fuelLogs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {fuelLogs.map(log => (
                        <div key={log.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                            <p className="text-sm text-gray-900 dark:text-gray-100">
                                {log.timestamp.toDate().toLocaleDateString()}
                            </p>
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                                €{log.cost.toFixed(2)} ({log.fuelAmountLiters.toFixed(2)}L @ {isFinite(log.cost / log.fuelAmountLiters) ? (log.cost / log.fuelAmountLiters).toFixed(3) : t('stationTable.noData')}/L)
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <p>{t('stationDetail.noLogsFound')}</p>
                </div>
            )}
        </div>
    );
};

export default StationDetail;
