// src/firebase/__tests__/firestoreService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    beforeEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy.mockClear(); // Clear mock calls before each test
        auth.currentUser = { uid: mockUserId } as any; // Mock logged-in user
        
        // Reset mock implementations for each test
        vi.mocked(collection).mockReturnValue({} as any);
        vi.mocked(query).mockReturnValue({} as any);
        vi.mocked(where).mockReturnValue({} as any);
        vi.mocked(orderBy).mockReturnValue({} as any);
    });

    describe('fetchFuelLogsByStationId', () => {
        it('should fetch logs for a given stationId and userId successfully', async () => {
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
            } as any);

            const result = await fetchFuelLogsByStationId(mockStationId);

            expect(collection).toHaveBeenCalledWith(db, 'fuelLogs');
            expect(query).toHaveBeenCalledWith(
                {} as any, // Mocked collection ref
                {} as any, // Mocked where clause for userId
                {} as any, // Mocked where clause for stationId
                {} as any  // Mocked orderBy clause
            );
            expect(where).toHaveBeenCalledWith('userId', '==', mockUserId);
            expect(where).toHaveBeenCalledWith('stationId', '==', mockStationId);
            expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
            expect(getDocs).toHaveBeenCalled();
            expect(result).toEqual(mockLogs);
        });

        it('should return an empty array if no user is logged in', async () => {
            auth.currentUser = null;

            const result = await fetchFuelLogsByStationId(mockStationId);

            expect(result).toEqual([]);
            expect(collection).not.toHaveBeenCalled();
            expect(getDocs).not.toHaveBeenCalled();
            expect(console.error).toHaveBeenCalledWith("No user logged in");
        });

        it('should return an empty array if no logs are found for the stationId', async () => {
            vi.mocked(getDocs).mockResolvedValueOnce({
                docs: []
            } as any);

            const result = await fetchFuelLogsByStationId(mockStationId);

            expect(result).toEqual([]);
            expect(collection).toHaveBeenCalled();
            expect(getDocs).toHaveBeenCalled();
        });

        it('should return an empty array and log an error if fetching fails', async () => {
            const mockError = new Error('Firestore error');
            vi.mocked(getDocs).mockRejectedValueOnce(mockError);

            const result = await fetchFuelLogsByStationId(mockStationId);

            expect(result).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(`Error fetching fuel logs for station ${mockStationId}:`, mockError);
        });
    });
});
