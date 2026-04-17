// src/firebase/firestoreService.ts
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './config'; // db and auth from your config file
import { Log, FuelLogData } from '../utils/types'; // Adjust path as needed

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