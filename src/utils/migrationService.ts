import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Log } from './types';
import { findNearestStation } from './locationService';
import { getOrCreateStation, updateStationMetrics } from '../firebase/firestoreService';

/**
 * Migrates existing logs for a user that have coordinates but no stationId.
 */
export async function migrateUserLogsToStations(userId: string): Promise<{ migrated: number, failed: number, skipped: number }> {
    const logsCollection = collection(db, 'fuelLogs');
    const q = query(
        logsCollection,
        where('userId', '==', userId),
        where('latitude', '!=', null)
    );

    const querySnapshot = await getDocs(q);
    const logsToMigrate = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Log))
        .filter(log => !log.stationId && log.latitude && log.longitude);

    let migrated = 0;
    let failed = 0;
    let skipped = 0;

    console.log(`Starting migration for ${logsToMigrate.length} logs...`);

    for (const log of logsToMigrate) {
        try {
            // Add a small delay to avoid hitting Overpass API rate limits too hard
            await new Promise(resolve => setTimeout(resolve, 1000));

            const nearest = await findNearestStation(log.latitude!, log.longitude!);
            if (nearest) {
                const stationId = await getOrCreateStation(nearest);
                const pricePerLitre = log.cost / log.fuelAmountLiters;

                await updateDoc(doc(db, 'fuelLogs', log.id), {
                    stationId: stationId
                });

                await updateStationMetrics(stationId, pricePerLitre);
                migrated++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error(`Failed to migrate log ${log.id}:`, error);
            failed++;
        }
    }

    return { migrated, failed, skipped };
}
