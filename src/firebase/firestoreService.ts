// src/firebase/firestoreService.ts
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc, // Import addDoc
  doc, // Import doc
  updateDoc, // Import updateDoc
  deleteDoc, // Import deleteDoc
  serverTimestamp // Optional: for created/updated at timestamps for vehicles
} from 'firebase/firestore';
import { db, auth } from './config'; // db and auth from your config file
import { Log, Vehicle } from '../utils/types'; // Adjust path as needed, import Vehicle

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

// --- Vehicle Management Functions ---

const VEHICLES_COLLECTION = 'vehicles';

// Add a new vehicle
export const addVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'userId'>): Promise<string | null> => {
  if (!auth.currentUser) {
    console.error("No user logged in. Cannot add vehicle.");
    return null;
  }
  try {
    const docRef = await addDoc(collection(db, VEHICLES_COLLECTION), {
      ...vehicleData,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp() // Optional: for tracking when it was added
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding vehicle:", error);
    return null;
  }
};

// Fetch all vehicles for the current user
export const fetchUserVehicles = async (): Promise<Vehicle[]> => {
  if (!auth.currentUser) {
    console.error("No user logged in. Cannot fetch vehicles.");
    return [];
  }
  const vehiclesCollection = collection(db, VEHICLES_COLLECTION);
  const q = query(
    vehiclesCollection,
    where('userId', '==', auth.currentUser.uid),
    orderBy('name', 'asc') // Or orderBy 'createdAt' or another field
  );

  try {
    const querySnapshot = await getDocs(q);
    const vehicles: Vehicle[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<Vehicle, 'id'>)
    }));
    return vehicles;
  } catch (error) {
    console.error("Error fetching user vehicles:", error);
    return [];
  }
};

// Update an existing vehicle
export const updateVehicle = async (vehicleId: string, updates: Partial<Omit<Vehicle, 'id' | 'userId'>>): Promise<boolean> => {
  if (!auth.currentUser) {
    console.error("No user logged in. Cannot update vehicle.");
    return false;
  }
  try {
    const vehicleDocRef = doc(db, VEHICLES_COLLECTION, vehicleId);
    // Ensure the vehicle belongs to the current user before updating (optional, depends on your rules)
    // For added security, you might fetch the doc first and check userId
    await updateDoc(vehicleDocRef, {
        ...updates,
        updatedAt: serverTimestamp() // Optional: for tracking updates
    });
    return true;
  } catch (error) {
    console.error("Error updating vehicle:", error);
    return false;
  }
};

// Delete a vehicle
export const deleteVehicle = async (vehicleId: string): Promise<boolean> => {
  if (!auth.currentUser) {
    console.error("No user logged in. Cannot delete vehicle.");
    return false;
  }
  try {
    const vehicleDocRef = doc(db, VEHICLES_COLLECTION, vehicleId);
    // Ensure the vehicle belongs to the current user before deleting (optional)
    await deleteDoc(vehicleDocRef);
    return true;
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    // It might be useful to also disassociate this vehicleId from fuel logs,
    // or handle that logic elsewhere (e.g., set vehicleId to null or a special "deleted" ID).
    // For now, just deleting the vehicle document.
    return false;
  }
};

// You could add other Firestore-related functions here later (e.g., addFuelLog, updateFuelLog)
// Consider refactoring addFuelLog from QuickLogPage.tsx to here for consistency if desired.