// src/firebase/firestoreService.test.ts
import {
  addVehicle,
  fetchUserVehicles,
  updateVehicle,
  deleteVehicle,
} from './firestoreService'; // Adjust path as needed
import { auth } from './config'; // We'll mock parts of these
import {
  addDoc,
  getDocs,
  query, // query is used by fetchUserVehicles
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Vehicle } from '../utils/types';

// Mock Firebase external dependencies
jest.mock('firebase/firestore', () => {
  const originalFirestore = jest.requireActual('firebase/firestore');
  return {
    ...originalFirestore,
    collection: jest.fn().mockName('collection'), // Mocked as it's used by the service
    addDoc: jest.fn().mockName('addDoc'),
    getDocs: jest.fn().mockName('getDocs'),
    query: jest.fn().mockName('query'),
    where: jest.fn().mockName('where'),
    orderBy: jest.fn().mockName('orderBy'),
    doc: jest.fn().mockImplementation((_db, collectionName, id) => ({ id, path: `${collectionName}/${id}` })).mockName('doc'), // _db marked as unused
    updateDoc: jest.fn().mockName('updateDoc'),
    deleteDoc: jest.fn().mockName('deleteDoc'),
    serverTimestamp: jest.fn(() => ({ type: 'timestamp' })).mockName('serverTimestamp'),
  };
});

// Mock auth module from './config'
jest.mock('./config', () => ({
  auth: {
    currentUser: null, // Default to no user
  },
  // db is not explicitly used by the service functions themselves,
  // but firestore operations like doc() require it as the first argument.
  // The mock for doc() above handles this by accepting _db.
  // If collection() or other direct calls needed db, we'd provide a mock for it.
  db: { type: 'mockFirestoreDb' },
}));

const mockVehicleData: Omit<Vehicle, 'id' | 'userId'> = {
  name: 'Test Car',
  make: 'Tesla',
  model: 'Model S',
  year: 2020,
};

const mockVehicleId = 'testVehicleId123';
const mockUserId = 'testUser123';

describe('firestoreService - Vehicle Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth.currentUser as any) = { uid: mockUserId };
  });

  describe('addVehicle', () => {
    it('should add a vehicle and return its ID if user is logged in', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: mockVehicleId });
      const result = await addVehicle(mockVehicleData);
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(), // This is the CollectionReference
        {
          ...mockVehicleData,
          userId: mockUserId,
          createdAt: { type: 'timestamp' }, // From serverTimestamp mock
        }
      );
      expect(result).toBe(mockVehicleId);
    });

    it('should return null if user is not logged in', async () => {
      (auth.currentUser as any) = null;
      const result = await addVehicle(mockVehicleData);
      expect(addDoc).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null if addDoc fails', async () => {
      (addDoc as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      const result = await addVehicle(mockVehicleData);
      expect(result).toBeNull();
    });
  });

  describe('fetchUserVehicles', () => {
    it('should fetch and return vehicles for the logged-in user', async () => {
      const mockDocs = [
        { id: 'v1', data: () => ({ name: 'Car 1', make: 'Tesla', userId: mockUserId }) },
        { id: 'v2', data: () => ({ name: 'Car 2', make: 'Toyota', userId: mockUserId }) },
      ];
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockDocs });
      const result = await fetchUserVehicles();
      expect(getDocs).toHaveBeenCalled();
      expect(query).toHaveBeenCalled();
      expect(result).toEqual([
        { id: 'v1', name: 'Car 1', make: 'Tesla', userId: mockUserId },
        { id: 'v2', name: 'Car 2', make: 'Toyota', userId: mockUserId },
      ]);
    });

    it('should return an empty array if no vehicles are found', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      const result = await fetchUserVehicles();
      expect(result).toEqual([]);
    });

    it('should return an empty array if user is not logged in', async () => {
      (auth.currentUser as any) = null;
      const result = await fetchUserVehicles();
      expect(getDocs).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return an empty array if getDocs fails', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      const result = await fetchUserVehicles();
      expect(result).toEqual([]);
    });
  });

  describe('updateVehicle', () => {
    it('should update a vehicle and return true if user is logged in', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      const mockVehicleDocRef = { id: mockVehicleId, path: `vehicles/${mockVehicleId}` };
      (doc as jest.Mock).mockReturnValueOnce(mockVehicleDocRef);

      const result = await updateVehicle(mockVehicleId, { name: 'Updated Name' });

      expect(doc).toHaveBeenCalledWith(expect.objectContaining({type: 'mockFirestoreDb'}), 'vehicles', mockVehicleId);
      expect(updateDoc).toHaveBeenCalledWith(mockVehicleDocRef, {
        name: 'Updated Name',
        updatedAt: { type: 'timestamp' }, // From serverTimestamp mock
      });
      expect(result).toBe(true);
    });

    it('should return false if user is not logged in', async () => {
      (auth.currentUser as any) = null;
      const result = await updateVehicle(mockVehicleId, { name: 'Updated Name' });
      expect(updateDoc).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if updateDoc fails', async () => {
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      const result = await updateVehicle(mockVehicleId, { name: 'Updated Name' });
      expect(result).toBe(false);
    });
  });

  describe('deleteVehicle', () => {
    it('should delete a vehicle and return true if user is logged in', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      const mockVehicleDocRef = { id: mockVehicleId, path: `vehicles/${mockVehicleId}` };
      (doc as jest.Mock).mockReturnValueOnce(mockVehicleDocRef);

      const result = await deleteVehicle(mockVehicleId);
      expect(doc).toHaveBeenCalledWith(expect.objectContaining({type: 'mockFirestoreDb'}), 'vehicles', mockVehicleId);
      expect(deleteDoc).toHaveBeenCalledWith(mockVehicleDocRef);
      expect(result).toBe(true);
    });

    it('should return false if user is not logged in', async () => {
      (auth.currentUser as any) = null;
      const result = await deleteVehicle(mockVehicleId);
      expect(deleteDoc).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if deleteDoc fails', async () => {
      (deleteDoc as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      const result = await deleteVehicle(mockVehicleId);
      expect(result).toBe(false);
    });
  });
});
