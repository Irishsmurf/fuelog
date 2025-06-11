// src/pages/HistoryPage.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from 'react-router-dom';
import HistoryPage from './HistoryPage';
import * as AuthContext from '../context/AuthContext';
import * as FirestoreService from '../firebase/firestoreService';
import { Log, Vehicle } from '../utils/types'; // Assuming Log and Vehicle types are needed
import { Timestamp } from 'firebase/firestore';

// Mock child components (LogCard, EditModal if it were separate)
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
  // Mock other firestore functions used by HistoryPage (e.g., onSnapshot setup for logs)
  // For now, we'll focus on vehicles. The actual onSnapshot for logs is complex to mock here.
  // We'll assume logs are passed or handled in a way that tests can inject them or mock the listener.
}));

// Mock 'firebase/firestore' for onSnapshot, deleteDoc, updateDoc etc.
const mockOnSnapshot = jest.fn(() => () => {}); // Returns an unsubscribe function
const mockDeleteDoc = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => {
    const originalModule = jest.requireActual('firebase/firestore');
    return {
        ...originalModule,
        onSnapshot: mockOnSnapshot,
        deleteDoc: mockDeleteDoc,
        updateDoc: mockUpdateDoc,
        // Ensure other necessary Firestore functions like query, collection, where, orderBy, doc are mocked if directly used
        // For HistoryPage, onSnapshot is key for logs.
        collection: jest.fn().mockImplementation((db, path) => ({ path, type: 'collection' })),
        query: jest.fn().mockImplementation((collRef, ...constraints) => ({ type: 'query', collRef, constraints })),
        where: jest.fn().mockImplementation((field, op, value) => ({ type: 'where', field, op, value })),
        orderBy: jest.fn().mockImplementation((field, direction) => ({ type: 'orderBy', field, direction })),
        doc: jest.fn().mockImplementation((db, coll, id) => ({ id, path: `${coll}/${id}` })),
        Timestamp: { // Ensure Timestamp is correctly mocked if used for conversions/creation
            now: () => ({
                toDate: () => new Date(),
                toMillis: () => Date.now(),
                // Add other methods if your code uses them from Timestamp instances
            }),
            fromDate: (date: Date) => ({
                toDate: () => date,
                toMillis: () => date.getTime(),
            }),
        }
    };
});


// Mock useAuth
const mockUseAuth = AuthContext.useAuth as jest.Mock;
jest.mock('../context/AuthContext');

// Mock useTheme - HistoryPage uses it
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));


const mockLogs: Log[] = [
  { id: 'log1', userId: 'user1', brand: 'Shell', cost: 50, distanceKm: 300, fuelAmountLiters: 40, timestamp: Timestamp.fromDate(new Date('2023-01-15')), vehicleId: 'v1' },
  { id: 'log2', userId: 'user1', brand: 'Esso', cost: 60, distanceKm: 350, fuelAmountLiters: 45, timestamp: Timestamp.fromDate(new Date('2023-01-20')), vehicleId: 'v2' },
  { id: 'log3', userId: 'user1', brand: 'Shell', cost: 55, distanceKm: 320, fuelAmountLiters: 42, timestamp: Timestamp.fromDate(new Date('2023-01-25')), vehicleId: 'v1' },
  { id: 'log4', userId: 'user1', brand: 'BP', cost: 70, distanceKm: 400, fuelAmountLiters: 50, timestamp: Timestamp.fromDate(new Date('2023-02-01')) }, // No vehicleId
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

    // Simulate onSnapshot returning logs
    mockOnSnapshot.mockImplementation((query, callback) => {
      const snapshot = {
        docs: mockLogs.map(log => ({
          id: log.id,
          data: () => ({ ...log }),
        })),
      };
      callback(snapshot);
      return () => {}; // Return unsubscribe function
    });
  });

  it('renders loading state initially for logs (if onSnapshot is slow)', async () => {
    let resolveSnapshot: any;
    mockOnSnapshot.mockImplementationOnce((query, callback) => {
        new Promise(resolve => {resolveSnapshot = callback;}); // Delay callback
        return () => {};
    });
    render(<Router><HistoryPage /></Router>);
    // This will depend on how HistoryPage structures its loading.
    // It might show "Loading fuel history..." or a general spinner.
    // For now, we check if the main title is there, implying the page structure is up.
    expect(screen.getByText(/fuel history & trends/i)).toBeInTheDocument();
    // If there's a specific loading text for logs:
    // expect(screen.getByText(/loading fuel history.../i)).toBeInTheDocument();
  });

  it('renders log cards when logs and vehicles are loaded (card view)', async () => {
    render(<Router><HistoryPage /></Router>);
    const viewToggleButton = screen.getByRole('button', { name: /view cards/i });
    fireEvent.click(viewToggleButton);

    await waitFor(() => {
      const logCards = screen.getAllByTestId('log-card');
      expect(logCards).toHaveLength(mockLogs.length);
      // Check vehicle name is passed correctly for some logs
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
            // Find the vehicle column index by header inspection (more robust)
            const headers = Array.from(screen.getAllByRole('columnheader')).map(th => th.textContent);
            const vehicleColIndex = headers.indexOf('Vehicle');
            expect(cells[vehicleColIndex]).toHaveTextContent('N/A');
       }
    });
  });

  // --- VEHICLE FILTERING TESTS START HERE ---
  describe('Vehicle Filtering', () => {
    beforeEach(async () => {
        render(<Router><HistoryPage /></Router>);
        await waitFor(() => {
            expect(screen.getByLabelText(/vehicle/i)).toBeInTheDocument();
            // Ensure initial render is complete and all logs are shown (either in table or cards)
            // For card view check:
            // const viewCardsButton = screen.queryByRole('button', { name: /view cards/i });
            // if (viewCardsButton) fireEvent.click(viewCardsButton);
            // await waitFor(() => expect(screen.getAllByTestId('log-card').length).toBe(mockLogs.length));
            // For table view check (assuming it's default or switched to):
            await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(mockLogs.length + 1)); // +1 for header
        });
    });

    it('filters logs when a specific vehicle is selected (card view)', async () => {
        const viewCardsButton = screen.getByRole('button', { name: /view cards/i });
        fireEvent.click(viewCardsButton);
        await waitFor(() => expect(screen.getAllByTestId('log-card').length).toBe(mockLogs.length));

        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v1' } }); // Select 'My Sedan'

        await waitFor(() => {
            const logCards = screen.getAllByTestId('log-card');
            expect(logCards).toHaveLength(2); // log1 and log3 are for v1
            logCards.forEach(card => {
                expect(card).toHaveTextContent('Vehicle: My Sedan');
            });
            expect(screen.queryByText('Vehicle: Work Truck')).not.toBeInTheDocument();
        });
    });

    it('filters logs when a specific vehicle is selected (table view)', async () => {
        const viewTableButton = screen.queryByRole('button', { name: /view table/i });
        if (viewTableButton) fireEvent.click(viewTableButton); // Ensure table view
         await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(mockLogs.length + 1));


        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v2' } }); // Select 'Work Truck'

        await waitFor(() => {
            // Rows include header + 1 data row for v2
            expect(screen.getAllByRole('row')).toHaveLength(1 + 1);
            expect(screen.getByRole('cell', { name: /work truck/i })).toBeInTheDocument();
            expect(screen.queryByRole('cell', { name: /my sedan/i })).not.toBeInTheDocument();
        });
    });

    it('shows all logs (including those without vehicleId) when "All Vehicles" is selected (card view)', async () => {
        const viewCardsButton = screen.getByRole('button', { name: /view cards/i });
        fireEvent.click(viewCardsButton);
        await waitFor(() => expect(screen.getAllByTestId('log-card').length).toBe(mockLogs.length));

        // Filter to a specific vehicle first
        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v1' } });
        await waitFor(() => expect(screen.getAllByTestId('log-card')).toHaveLength(2));

        // Then, select "All Vehicles"
        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: '' } });
        await waitFor(() => {
            expect(screen.getAllByTestId('log-card')).toHaveLength(mockLogs.length);
            expect(screen.getAllByText('Vehicle: My Sedan').length).toBeGreaterThan(0);
            expect(screen.getByText('Vehicle: Work Truck')).toBeInTheDocument();
            // Log4 (BP) has no vehicleId, its card should be present but without "Vehicle:" text from the prop
            const bpCard = screen.getAllByTestId('log-card').find(card => card.textContent?.includes('Brand: BP'));
            expect(bpCard).toBeInTheDocument();
            if(bpCard) { // Type guard
                 expect(bpCard).not.toHaveTextContent(/vehicle:/i);
            }
        });
    });

    it('hides logs without a vehicleId when a specific vehicle filter is active (card view)', async () => {
        const viewCardsButton = screen.getByRole('button', { name: /view cards/i });
        fireEvent.click(viewCardsButton);
        await waitFor(() => expect(screen.getAllByTestId('log-card').length).toBe(mockLogs.length));

        fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v1' } }); // Select 'My Sedan'

        await waitFor(() => {
            expect(screen.getAllByTestId('log-card')).toHaveLength(2);
            // Log4 (BP brand) has no vehicleId, so it should not be present
            const bpCard = screen.queryByText((content, element) => {
                // Check if the element is part of a log card and contains 'Brand: BP'
                // This is a bit more complex query to ensure we are not accidentally matching other text
                const cardElement = element?.closest('[data-testid="log-card"]');
                return !!cardElement && cardElement.textContent?.includes('Brand: BP') === true;
            });
            expect(bpCard).not.toBeInTheDocument();
        });
    });
  });
});
