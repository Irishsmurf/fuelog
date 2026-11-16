// src/firebase/firestoreService.ts
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from './config'; // db and auth from your config file
import { Log, Station, Vehicle } from '../utils/types';
import { previousReading } from '@fuelog/core';
import { fuelLogSchema, stationSchema, vehicleSchema, withId } from './converters';
import { OSMStation } from '../utils/locationService';

export class FirestoreOfflineError extends Error {
  constructor(message = 'You are offline. Please check your connection and try again.') {
    super(message);
    this.name = 'FirestoreOfflineError';
  }
}

const rethrowFirestoreError = (error: unknown, context: string): never => {
  console.error(context, error);
  if (!navigator.onLine) {
    throw new FirestoreOfflineError();
  }
  throw error instanceof Error ? error : new Error(String(error));
};

export const fetchFuelLocations = async (): Promise<Log[]> => {
  if (!auth.currentUser) {
    throw new Error('No user logged in');
  }

  const logsCollection = collection(db, 'fuelLogs');
  // Consider adding orderBy('timestamp', 'desc') if needed
  const q = query(
      logsCollection,
      where('userId', '==', auth.currentUser.uid),
      where('latitude', '!=', null), // Directly query for logs with latitude
      orderBy('timestamp', 'desc'), // Order by timestamp if needed
  );


  try {
    const querySnapshot = await getDocs(q);
    const locations: Log[] = querySnapshot.docs.map(doc => withId(fuelLogSchema, 'fuelLog', doc));
    // Additional filtering just in case Firestore rules change or for robustness
    return locations.filter(p => p.latitude !== undefined && p.longitude !== undefined);
  } catch (error) {
    return rethrowFirestoreError(error, 'Error fetching fuel locations:');
  }
};

// You could add other Firestore-related functions here later (e.g., addFuelLog, updateFuelLog)

/** How many recent logs to scan for the closest earlier odometer reading. */
const ODOMETER_LOOKBACK = 20;

/**
 * The odometer reading a new fill-up at `before` should be measured from: the
 * closest *earlier* reading for the vehicle. Skips recent logs that have no
 * reading (previously one such log hid every earlier reading) and handles
 * back-dated fill-ups.
 */
export const getLastOdometerReading = async (vehicleId: string, before: Date = new Date()): Promise<number | null> => {
    if (!auth.currentUser) {
        throw new Error('No user logged in');
    }

    const q = query(
        collection(db, 'fuelLogs'),
        where('userId', '==', auth.currentUser.uid),
        where('vehicleId', '==', vehicleId),
        where('timestamp', '<', Timestamp.fromDate(before)),
        orderBy('timestamp', 'desc'),
        limit(ODOMETER_LOOKBACK)
    );

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        const entries = querySnapshot.docs.map(doc => {
            const log = withId(fuelLogSchema, 'fuelLog', doc);
            return { id: log.id, at: log.timestamp.toMillis?.() ?? log.timestamp.toDate().getTime(), odometerKm: log.odometerKm };
        });
        return previousReading(entries, before.getTime());
    } catch (error) {
        return rethrowFirestoreError(error, 'Error fetching last odometer reading:');
    }
};

/**
 * Fetches a single station document by its Firestore doc ID.
 * Returns null if no such station exists.
 */
export const fetchStationById = async (stationId: string): Promise<Station | null> => {
    const stationRef = doc(db, 'stations', stationId);
    const stationSnap = await getDoc(stationRef);
    if (!stationSnap.exists()) return null;
    return withId(stationSchema, 'station', stationSnap) as Station;
};

/**
 * Gets a station by OSM ID or creates it if it doesn't exist.
 * Sanitizes the ID for Firestore doc path.
 */
export const getOrCreateStation = async (osmStation: OSMStation): Promise<string> => {
    // OSM IDs are unique, we use them as Firestore document IDs
    const stationId = osmStation.id.replace(/\//g, '_'); 
    const stationRef = doc(db, 'stations', stationId);
    const stationSnap = await getDoc(stationRef);

    if (stationSnap.exists()) {
        return stationId;
    }

    const newStation: Omit<Station, 'id'> = {
        osmId: osmStation.osmId,
        name: osmStation.name,
        brand: osmStation.brand || '',
        latitude: osmStation.latitude,
        longitude: osmStation.longitude,
        address: osmStation.address || '',
        logCount: 0,
        avgPrice: 0
    };

    await setDoc(stationRef, newStation);
    return stationId;
};

/**
 * Fetches all unique stations for a set of logs.
 */
export const fetchUserStations = async (logs: Log[]): Promise<Station[]> => {
    const stationIds = Array.from(new Set(logs.map(l => l.stationId).filter(Boolean))) as string[];
    if (stationIds.length === 0) return [];

    const stations: Station[] = [];
    // Firestore limit for 'in' queries is 30, so we might need to batch if many stations
    for (let i = 0; i < stationIds.length; i += 30) {
        const batchIds = stationIds.slice(i, i + 30);
        const q = query(collection(db, 'stations'), where('__name__', 'in', batchIds));
        const snap = await getDocs(q);
        snap.forEach(doc => {
            stations.push(withId(stationSchema, 'station', doc) as Station);
        });
    }

    return stations;
};

/**
 * Fetches fuel log data for a specific station.
 * @param stationId The ID of the station to fetch logs for.
 * @returns A promise that resolves to an array of Log objects.
 */
export const fetchFuelLogsByStationId = async (stationId: string, maxResults: number = 12): Promise<Log[]> => {
    if (!auth.currentUser) {
        throw new Error('No user logged in');
    }

    const logsCollection = collection(db, 'fuelLogs');
    const q = query(
        logsCollection,
        where('userId', '==', auth.currentUser.uid),
        where('stationId', '==', stationId),
        orderBy('timestamp', 'desc'),
        limit(maxResults)
    );

    try {
        const querySnapshot = await getDocs(q);
        const logs: Log[] = querySnapshot.docs.map(doc => withId(fuelLogSchema, 'fuelLog', doc));
        return logs;
    } catch (error) {
        return rethrowFirestoreError(error, `Error fetching fuel logs for station ${stationId}:`);
    }
};
/**
 * The signed-in user's vehicles, sorted by name. Archived vehicles are
 * excluded unless `includeArchived` is set. Replaces the copy-pasted query
 * that lived in five pages.
 */
export const fetchVehicles = async (userId: string, { includeArchived = false } = {}): Promise<Vehicle[]> => {
    try {
        const snap = await getDocs(query(collection(db, 'vehicles'), where('userId', '==', userId)));
        const list: Vehicle[] = [];
        snap.forEach(d => list.push(withId(vehicleSchema, 'vehicle', d)));
        return list
            .filter(v => includeArchived || !v.isArchived)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (error) {
        return rethrowFirestoreError(error, 'Error fetching vehicles:');
    }
};

/** The vehicle to preselect: the default one, else the first. */
export const pickDefaultVehicle = (vehicles: Vehicle[]): Vehicle | undefined =>
    vehicles.find(v => v.isDefault) ?? vehicles[0];
