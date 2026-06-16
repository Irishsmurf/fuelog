// src/firebase/__tests__/firestoreService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollectionReference, Query, QueryConstraint, QuerySnapshot, QueryFieldFilterConstraint, QueryOrderByConstraint } from 'firebase/firestore';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config'; // Mocked config for auth and db
import { fetchFuelLogsByStationId } from '../firestoreService';
import { Log } from '../../utils/types';

// Mock Firebase
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        collection: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        getDocs: vi.fn(),
        orderBy: vi.fn(),
        Timestamp: {
            fromDate: vi.fn((date: Date) => ({
                toDate: () => date,
                // Add other Timestamp methods if needed by the component under test
            })),
            now: vi.fn(() => ({ toDate: () => new Date() })),
        },
    };
});

vi.mock('../config', () => ({
    auth: {
        currentUser: null,
    },
    db: {}, // Mock db object
}));

// Mock console.error
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('firestoreService', () => {
    const mockUserId = 'testUserId';
    const mockStationId = 'testStationId';
    let mockCurrentUser: { uid: string } | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy.mockClear();
        
        mockCurrentUser = { uid: mockUserId };
        vi.spyOn(auth, 'currentUser', 'get').mockImplementation(() => mockCurrentUser as unknown as import('firebase/auth').User | null);

        // Reset mock implementations for each test
        vi.mocked(collection).mockReturnValue({} as CollectionReference);
        vi.mocked(query).mockReturnValue({} as Query);
        vi.mocked(where).mockReturnValue({} as unknown as QueryFieldFilterConstraint);
        vi.mocked(orderBy).mockReturnValue({} as unknown as QueryOrderByConstraint);
    });

    describe('fetchFuelLogsByStationId', () => {
        it('should fetch logs for a given stationId and userId successfully', async () => {
            // mockCurrentUser is already set in beforeEach
            const mockLogs: Log[] = [
                {
                    id: 'log1',
                    userId: mockUserId,
                    timestamp: Timestamp.fromDate(new Date()),
                    brand: 'Station A',
                    cost: 50,
                    distanceKm: 500,
                    fuelAmountLiters: 40,
                    stationId: mockStationId,
                },
                {
                    id: 'log2',
                    userId: mockUserId,
                    timestamp: Timestamp.fromDate(new Date()),
                    brand: 'Station A',
                    cost: 60,
                    distanceKm: 600,
                    fuelAmountLiters: 50,
                    stationId: mockStationId,
                },
            ];

            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: mockLogs.map(log => ({ id: log.id, data: () => log }))
            } as unknown as QuerySnapshot);

            const result = await fetchFuelLogsByStationId(mockStationId);

            expect(collection).toHaveBeenCalledWith(db, 'fuelLogs');
            expect(query).toHaveBeenCalledWith(
                {} as CollectionReference,
                {} as QueryConstraint, // where userId
                {} as QueryConstraint, // where stationId
                {} as QueryConstraint  // orderBy timestamp
            );
            expect(where).toHaveBeenCalledWith('userId', '==', mockUserId);
            expect(where).toHaveBeenCalledWith('stationId', '==', mockStationId);
            expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
            expect(getDocs).toHaveBeenCalled();
            expect(result).toEqual(mockLogs);
        });

        it('should throw if no user is logged in', async () => {
            mockCurrentUser = null; // Set to null for this test

            await expect(fetchFuelLogsByStationId(mockStationId)).rejects.toThrow('No user logged in');
            expect(collection).not.toHaveBeenCalled();
            expect(getDocs).not.toHaveBeenCalled();
        });

        it('should return an empty array if no logs are found for the stationId', async () => {
            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: []
            } as unknown as QuerySnapshot);

            const result = await fetchFuelLogsByStationId(mockStationId);

            expect(result).toEqual([]);
            expect(collection).toHaveBeenCalled();
            expect(getDocs).toHaveBeenCalled();
        });

        it('should propagate the error if fetching fails', async () => {
            const mockError = new Error('Firestore error');
            vi.mocked(getDocs).mockRejectedValueOnce(mockError);

            await expect(fetchFuelLogsByStationId(mockStationId)).rejects.toThrow('Firestore error');
            expect(console.error).toHaveBeenCalledWith(`Error fetching fuel logs for station ${mockStationId}:`, mockError);
        });

        it('should throw a FirestoreOfflineError when the browser is offline', async () => {
            const mockError = new Error('Firestore error');
            vi.mocked(getDocs).mockRejectedValueOnce(mockError);
            vi.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(false);

            await expect(fetchFuelLogsByStationId(mockStationId)).rejects.toThrow('You are offline');
        });
    });
});
