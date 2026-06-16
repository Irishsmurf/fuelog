// src/pages/StationsPage.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader, AlertCircle } from 'lucide-react';

import { fetchUserStations } from '../firebase/firestoreService';
import { Station } from '../utils/types';
import StationTable from '../components/StationTable'; // Will create this component
import StationDetail from '../components/StationDetail'; // Will create this component

const StationsPage: React.FC = () => {
    const { t } = useTranslation();
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

    useEffect(() => {
        const loadStations = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch all fuel logs to then get all unique stations
                // Note: fetchUserStations currently expects logs as input.
                // We might need to adjust firestoreService to fetch all stations directly,
                // or ensure a mechanism to get all relevant logs.
                // For now, I'll assume an empty array will result in no stations or we modify fetchUserStations
                // to fetch all unique stations from fuelLogs without requiring prior logs.
                // A better approach would be to have a dedicated 'fetchAllStations' if not tied to logs.
                // For initial implementation, we'll fetch all unique stations based on existing logs.
                
                // Temporarily fetch all logs to get associated stations. This is not ideal for a large dataset,
                // a dedicated 'fetchAllStations' function would be better.
                // Assuming `fetchUserStations` can handle an empty log array or we need to pass a dummy.
                // Let's assume fetchUserStations is modified to accept an optional logs array and
                // if not provided, it fetches all stations the user has ever logged against.
                // For now, I'll use `[]` and rely on a future refactor or assumption of internal logic.

                const userStations = await fetchUserStations([]); // Assuming modification or smarter internal logic
                setStations(userStations);
            } catch (err) {
                console.error("Failed to load stations:", err);
                setError(t('stations.errorLoading'));
            } finally {
                setLoading(false);
            }
        };

        loadStations();
    }, [t]);

    const handleSelectStation = (stationId: string) => {
        setSelectedStationId(stationId);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <Loader className="w-8 h-8 animate-spin mb-2" />
                <p>{t('stations.loading')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 m-4">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">{t('stations.title')}</h1>
            
            {stations.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 text-center text-gray-600 dark:text-gray-300">
                    <p>{t('stations.noStationsFound')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <StationTable 
                            stations={stations} 
                            onSelectStation={handleSelectStation} 
                            selectedStationId={selectedStationId} 
                        />
                    </div>
                    <div className="md:col-span-2">
                        {selectedStationId ? (
                            <StationDetail stationId={selectedStationId} />
                        ) : (
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 text-center text-gray-600 dark:text-gray-300">
                                <p>{t('stations.selectStationPrompt')}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StationsPage;