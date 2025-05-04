// src/firebase/firestoreService.ts
import { addDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from './config'; // db and auth from your config file
import { Log, Vehicle } from '../utils/types'; // Adjust path as needed

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

export const fetchVehicles = async (): Promise<Vehicle[]> => {
    if (!auth.currentUser) {
        console.error("No user logged in");
        return [];
    }

    const vehiclesCollection = collection(db, 'vehicles');
    const q = query(
        vehiclesCollection,
        where('userId', '==', auth.currentUser.uid),
        orderBy('make') // Optional: Order by make or registration plate
    );

    try {
        const querySnapshot = await getDocs(q);
        const vehicles: Vehicle[] = querySnapshot.docs.map(doc => ({
            id: doc.id, // Use Firestore's auto-generated ID
            ...(doc.data() as Omit<Vehicle, 'id'>)
        }));
        return vehicles;
    } catch (error) {
        console.error("Error fetching vehicles:", error);
        return [];
    }
};

export const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'userId' | 'lastOdometerKm'>): Promise<string | null> => {
    if (!auth.currentUser) {
        console.error("No user logged in");
        return null;
    }

    try {
        const docRef = await addDoc(collection(db, 'vehicles'), {
            ...vehicleData,
            userId: auth.currentUser.uid,
            lastOdometerKm: vehicleData.initialOdometerKm, // Initialize last reading
            // Add a timestamp if you want to know when it was added
            // createdAt: Timestamp.now()
        });
        console.log("Vehicle added with ID: ", docRef.id);
        return docRef.id; // Return the new document ID
    } catch (error) {
        console.error("Error adding vehicle: ", error);
        return null;
    }
};