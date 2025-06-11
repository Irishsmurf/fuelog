// src/pages/HistoryPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import HistoryPage from './HistoryPage';
import * as AuthContext from '../context/AuthContext';
import * as FirestoreService from '../firebase/firestoreService';
import { Log, Vehicle } from '../utils/types';
import { Timestamp, Query, QuerySnapshot, Unsubscribe, DocumentData, QueryDocumentSnapshot, SnapshotMetadata } from 'firebase/firestore'; // Added specific types for mock

// Mock child components
jest.mock('../components/LogCard', () => (props: any) => (
  <div data-testid="log-card">
    <p>Brand: {props.log.brand}</p>
    {props.vehicleName && <p>Vehicle: {props.vehicleName}</p>}
    <button onClick={() => props.onEdit(props.log)}>Edit-{props.log.id}</button>
    <button onClick={() => props.onDelete(props.log.id)}>Delete-{props.log.id}</button>
  </div>
));

// Mock firestoreService
jest.mock('../firebase/firestoreService', () => ({
  fetchUserVehicles: jest.fn(),
}));

// Create a more complete mock for QuerySnapshot
const createMockQuerySnapshot = (docsData: Array<{id: string, data: () => DocumentData}>): QuerySnapshot => {
  const mockDocs = docsData.map(docData => ({
    id: docData.id,
    data: docData.data,
    exists: () => true,
    ref: {} as any,
    get: (_fieldPath: string) => undefined,
  } as QueryDocumentSnapshot)); // Cast individual docs to QueryDocumentSnapshot

  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (callback: (result: QueryDocumentSnapshot) => void) => {
      mockDocs.forEach(doc => callback(doc));
    },
    docChanges: () => [],
    metadata: { hasPendingWrites: false, fromCache: false } as SnapshotMetadata,
    query: {} as Query,
  } as QuerySnapshot;
};


const mockOnSnapshot = jest.fn((_query: Query, callback: (snapshot: QuerySnapshot) => void): Unsubscribe => {
    // Default behavior: call callback with empty snapshot, return empty unsubscribe
    callback(createMockQuerySnapshot([])); // Use the helper
    return () => {};
});
const mockDeleteDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => {
    const originalModule = jest.requireActual('firebase/firestore');
    return {
        ...originalModule,
        onSnapshot: mockOnSnapshot,
        deleteDoc: mockDeleteDoc,
        updateDoc: mockUpdateDoc,
        collection: jest.fn().mockImplementation((_db, path) => ({ path, type: 'collection' })),
        query: jest.fn().mockImplementation((collRef, ...constraints) => ({ type: 'query', collRef, constraints })),
        where: jest.fn().mockImplementation((field, op, value) => ({ type: 'where', field, op, value })),
        orderBy: jest.fn().mockImplementation((field, direction) => ({ type: 'orderBy', field, direction })),
        doc: jest.fn().mockImplementation((_db, coll, id) => ({ id, path: `${coll}/${id}` })),
        Timestamp: {
            now: () => ({
                toDate: () => new Date(),
                toMillis: () => Date.now(),
            }),
            fromDate: (date: Date) => ({
                toDate: () => date,
                toMillis: () => date.getTime(),
            }),
        }
    };
});

const mockUseAuth = AuthContext.useAuth as jest.Mock;
jest.mock('../context/AuthContext');

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const mockLogs: Log[] = [
  { id: 'log1', userId: 'user1', brand: 'Shell', cost: 50, distanceKm: 300, fuelAmountLiters: 40, timestamp: Timestamp.fromDate(new Date('2023-01-15')), vehicleId: 'v1' },
  { id: 'log2', userId: 'user1', brand: 'Esso', cost: 60, distanceKm: 350, fuelAmountLiters: 45, timestamp: Timestamp.fromDate(new Date('2023-01-20')), vehicleId: 'v2' },
  { id: 'log3', userId: 'user1', brand: 'Shell', cost: 55, distanceKm: 320, fuelAmountLiters: 42, timestamp: Timestamp.fromDate(new Date('2023-01-25')), vehicleId: 'v1' },
  { id: 'log4', userId: 'user1', brand: 'BP', cost: 70, distanceKm: 400, fuelAmountLiters: 50, timestamp: Timestamp.fromDate(new Date('2023-02-01')) },
];

const mockVehicles: Vehicle[] = [
  { id: 'v1', userId: 'user1', name: 'My Sedan', make: 'Toyota', model: 'Camry' },
  { id: 'v2', userId: 'user1', name: 'Work Truck', make: 'Ford', model: 'F-150' },
];

describe('HistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' } });
    (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValue([...mockVehicles]);

    mockOnSnapshot.mockImplementation((_query: Query, callback: (snapshot: QuerySnapshot) => void): Unsubscribe => {
      const snapshotDocs = mockLogs.map(log => ({ id: log.id, data: () => ({ ...log }) }));
      callback(createMockQuerySnapshot(snapshotDocs));
      return () => {};
    });
  });

  it('renders loading state initially for logs (if onSnapshot is slow)', async () => {
    mockOnSnapshot.mockImplementationOnce((_query: Query, _callback: (snapshot: QuerySnapshot) => void): Unsubscribe => {
        return () => {}; // Return an empty unsubscribe function and never call callback
    });
    render(<Router><HistoryPage /></Router>);
    expect(screen.getByText(/fuel history & trends/i)).toBeInTheDocument();
    // Check for a loading indicator specific to logs if available, e.g.,
    // await waitFor(() => expect(screen.getByText(/loading fuel history.../i)).toBeInTheDocument());
  });

  it('renders log cards when logs and vehicles are loaded (card view)', async () => {
    render(<Router><HistoryPage /></Router>);
    const viewToggleButton = screen.getByRole('button', { name: /view cards/i });
    fireEvent.click(viewToggleButton);

    await waitFor(() => {
      const logCards = screen.getAllByTestId('log-card');
      expect(logCards).toHaveLength(mockLogs.length);
      expect(screen.getAllByText('Vehicle: My Sedan').length).toBeGreaterThan(0);
      expect(screen.getByText('Vehicle: Work Truck')).toBeInTheDocument();
    });
  });

  it('renders log table rows when logs and vehicles are loaded (table view)', async () => {
    render(<Router><HistoryPage /></Router>);
    const viewTableButton = screen.queryByRole('button', { name: /view table/i });
    if (viewTableButton) fireEvent.click(viewTableButton);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: /date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /vehicle/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /brand/i })).toBeInTheDocument();

      const row1_vehicle_cells = screen.getAllByRole('cell', { name: /my sedan/i });
      expect(row1_vehicle_cells.length).toBeGreaterThan(0);

      const log4_date_cell = screen.getByRole('cell', { name: new Date('2023-02-01').toLocaleDateString('en-IE')});
      const log4_row = log4_date_cell.closest('tr');
      expect(log4_row).not.toBeNull();
      if (log4_row) {
            const cells = log4_row.querySelectorAll('td');
            const headers = Array.from(screen.getAllByRole('columnheader')).map(th => th.textContent);
            const vehicleColIndex = headers.indexOf('Vehicle');
            expect(cells[vehicleColIndex]).toHaveTextContent('N/A');
       }
    });
  });

  describe('Vehicle Filtering', () => {
    beforeEach(async () => {
        render(<Router><HistoryPage /></Router>);
        await waitFor(() => {
            expect(screen.getByLabelText(/vehicle/i)).toBeInTheDocument();
            expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(mockLogs.length + 1);
        });
    });

    it('filters logs when a specific vehicle is selected (card view)', async () => {
        const viewCardsButton = screen.getByRole('button', { name: /view cards/i });
        fireEvent.click(viewCardsButton);
        await waitFor(() => expect(screen.getAllByTestId('log-card').length).toBe(mockLogs.length));

        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v1' } });

        await waitFor(() => {
            const logCards = screen.getAllByTestId('log-card');
            expect(logCards).toHaveLength(2);
            logCards.forEach(card => {
                expect(card).toHaveTextContent('Vehicle: My Sedan');
            });
            expect(screen.queryByText('Vehicle: Work Truck')).not.toBeInTheDocument();
        });
    });

    it('filters logs when a specific vehicle is selected (table view)', async () => {
        const viewTableButton = screen.queryByRole('button', { name: /view table/i });
        if (viewTableButton) fireEvent.click(viewTableButton);
         await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(mockLogs.length + 1));

        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v2' } });

        await waitFor(() => {
            expect(screen.getAllByRole('row')).toHaveLength(1 + 1);
            expect(screen.getByRole('cell', { name: /work truck/i })).toBeInTheDocument();
            expect(screen.queryByRole('cell', { name: /my sedan/i })).not.toBeInTheDocument();
        });
    });

    it('shows all logs (including those without vehicleId) when "All Vehicles" is selected (card view)', async () => {
        const viewCardsButton = screen.getByRole('button', { name: /view cards/i });
        fireEvent.click(viewCardsButton);
        await waitFor(() => expect(screen.getAllByTestId('log-card').length).toBe(mockLogs.length));

        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v1' } });
        await waitFor(() => expect(screen.getAllByTestId('log-card')).toHaveLength(2));

        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: '' } });
        await waitFor(() => {
            expect(screen.getAllByTestId('log-card')).toHaveLength(mockLogs.length);
            expect(screen.getAllByText('Vehicle: My Sedan').length).toBeGreaterThan(0);
            expect(screen.getByText('Vehicle: Work Truck')).toBeInTheDocument();
            const bpCard = screen.getAllByTestId('log-card').find(card => card.textContent?.includes('Brand: BP'));
            expect(bpCard).toBeInTheDocument();
            if(bpCard) {
                 expect(bpCard).not.toHaveTextContent(/vehicle:/i);
            }
        });
    });

    it('hides logs without a vehicleId when a specific vehicle filter is active (card view)', async () => {
        const viewCardsButton = screen.getByRole('button', { name: /view cards/i });
        fireEvent.click(viewCardsButton);
        await waitFor(() => expect(screen.getAllByTestId('log-card').length).toBe(mockLogs.length));

        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v1' } });

        await waitFor(() => {
            expect(screen.getAllByTestId('log-card')).toHaveLength(2);
            const bpCard = screen.queryByText((_content, element) => {
                const cardElement = element?.closest('[data-testid="log-card"]');
                return !!cardElement && cardElement.textContent?.includes('Brand: BP') === true;
            });
            expect(bpCard).not.toBeInTheDocument();
        });
    });
  });
});
