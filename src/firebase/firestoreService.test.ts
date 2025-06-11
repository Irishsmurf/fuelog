// src/firebase/firestoreService.test.ts
import {
  addVehicle,
  fetchUserVehicles,
  updateVehicle,
  deleteVehicle,
} from './firestoreService'; // Adjust path as needed
import { auth, db } from './config'; // We'll mock parts of these
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp, // Mock if used, though serverTimestamp itself doesn't need complex mock
} from 'firebase/firestore';
import { Vehicle } from '../utils/types';

// Mock Firebase external dependencies
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'), // Import and retain default behavior
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  doc: jest.fn().mockImplementation((db, collectionName, id) => ({ id, path: `${collectionName}/${id}` })), // Mock doc to return a basic object
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ type: 'timestamp' })), // Simple mock for serverTimestamp
}));

// Mock auth module from './config'
jest.mock('./config', () => ({
  auth: {
    currentUser: null, // Default to no user
  },
  db: {}, // db object itself doesn't need deep mocking for these tests
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
    // Reset mocks before each test
    jest.clearAllMocks();
    // Default to user being logged in for most tests
    (auth.currentUser as any) = { uid: mockUserId };
  });

  // Tests for addVehicle
  describe('addVehicle', () => {
    it('should add a vehicle and return its ID if user is logged in', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: mockVehicleId });
      const result = await addVehicle(mockVehicleData);
      expect(addDoc).toHaveBeenCalledWith(undefined, { // collection mock returns undefined
        ...mockVehicleData,
        userId: mockUserId,
        createdAt: { type: 'timestamp' },
      });
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

  // Tests for fetchUserVehicles
  describe('fetchUserVehicles', () => {
    it('should fetch and return vehicles for the logged-in user', async () => {
      const mockDocs = [
        { id: 'v1', data: () => ({ name: 'Car 1', make: 'Tesla', userId: mockUserId }) },
        { id: 'v2', data: () => ({ name: 'Car 2', make: 'Toyota', userId: mockUserId }) },
      ];
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: mockDocs });
      const result = await fetchUserVehicles();
      expect(getDocs).toHaveBeenCalled();
      expect(query).toHaveBeenCalled(); // Ensure query was called
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

  // Tests for updateVehicle
  describe('updateVehicle', () => {
    it('should update a vehicle and return true if user is logged in', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      const mockVehicleDocRef = { id: mockVehicleId, path: `vehicles/${mockVehicleId}` };
      (doc as jest.Mock).mockReturnValueOnce(mockVehicleDocRef); // Ensure doc returns the expected ref

      const result = await updateVehicle(mockVehicleId, { name: 'Updated Name' });

      expect(doc).toHaveBeenCalledWith(undefined, 'vehicles', mockVehicleId); // db mock is undefined
      expect(updateDoc).toHaveBeenCalledWith(mockVehicleDocRef, {
        name: 'Updated Name',
        updatedAt: { type: 'timestamp' },
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

  // Tests for deleteVehicle
  describe('deleteVehicle', () => {
    it('should delete a vehicle and return true if user is logged in', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      const mockVehicleDocRef = { id: mockVehicleId, path: `vehicles/${mockVehicleId}` };
      (doc as jest.Mock).mockReturnValueOnce(mockVehicleDocRef);


      const result = await deleteVehicle(mockVehicleId);
      expect(doc).toHaveBeenCalledWith(undefined, 'vehicles', mockVehicleId);
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
