// src/firebase/firestoreService.ts
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from './config'; // db and auth from your config file
import { Log } from '../utils/types'; // Adjust path as needed

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