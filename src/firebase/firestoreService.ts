// src/firebase/firestoreService.ts
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from './config'; // db and auth from your config file
import { Log, FuelLogData, Station } from '../utils/types'; // Adjust path as needed
import { OSMStation } from '../utils/locationService';

export const fetchFuelLocations = async (): Promise<Log[]> => {
  if (!auth.currentUser) {
    console.error("No user logged in");
    return [];
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
    const locations: Log[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<Log, 'id'>)
    }));
    // Additional filtering just in case Firestore rules change or for robustness
    return locations.filter(p => p.latitude !== undefined && p.longitude !== undefined);
  } catch (error) {
    console.error("Error fetching fuel locations:", error);
    return [];
  }
};

// You could add other Firestore-related functions here later (e.g., addFuelLog, updateFuelLog)

export const getLastOdometerReading = async (vehicleId: string): Promise<number | null> => {
    if (!auth.currentUser) return null;
    
    const q = query(
        collection(db, 'fuelLogs'),
        where('userId', '==', auth.currentUser.uid),
        where('vehicleId', '==', vehicleId),
        orderBy('timestamp', 'desc'),
        limit(1)
    );
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        const lastLog = querySnapshot.docs[0].data() as FuelLogData;
        return lastLog.odometerKm ?? null;
    } catch (error) {
        console.error("Error fetching last odometer reading:", error);
        return null;
    }
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
 * Updates station metrics when a new log is added.
 */
export const updateStationMetrics = async (stationId: string, pricePerLitre: number) => {
    const stationRef = doc(db, 'stations', stationId);
    const stationSnap = await getDoc(stationRef);

    if (!stationSnap.exists()) return;

    const data = stationSnap.data() as Station;
    const currentCount = data.logCount || 0;
    const currentAvg = data.avgPrice || 0;

    // Calculate new average
    const newAvg = ((currentAvg * currentCount) + pricePerLitre) / (currentCount + 1);

    await updateDoc(stationRef, {
        logCount: increment(1),
        avgPrice: newAvg,
        lastPrice: pricePerLitre
    });
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
            stations.push({ id: doc.id, ...(doc.data() as Omit<Station, 'id'>) });
        });
    }

    return stations;
};