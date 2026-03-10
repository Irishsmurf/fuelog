// src/firebase/aggregationService.ts
import { collection, query, where, getAggregateFromServer, sum, count } from 'firebase/firestore';
import { db } from './config';

export interface LifetimeStats {
    totalCost: number;
    totalLitres: number;
    totalDistanceKm: number;
    logCount: number;
}

/**
 * Fetches lifetime aggregate stats for a user using Firestore server-side aggregation.
 * Optionally filtered by vehicleId. Avoids downloading all documents.
 */
export async function getLifetimeStats(userId: string, vehicleId?: string): Promise<LifetimeStats> {
    const constraints = [
        where('userId', '==', userId),
        ...(vehicleId ? [where('vehicleId', '==', vehicleId)] : []),
    ];
    const q = query(collection(db, 'fuelLogs'), ...constraints);

    const result = await getAggregateFromServer(q, {
        totalCost: sum('cost'),
        totalLitres: sum('fuelAmountLiters'),
        totalDistanceKm: sum('distanceKm'),
        logCount: count(),
    });

    const data = result.data();
    return {
        totalCost: data.totalCost ?? 0,
        totalLitres: data.totalLitres ?? 0,
        totalDistanceKm: data.totalDistanceKm ?? 0,
        logCount: data.logCount ?? 0,
    };
}
