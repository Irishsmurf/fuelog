// src/pages/QuickLogPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom'; // For Link component
import QuickLogPage from './QuickLogPage';
import * as AuthContext from '../context/AuthContext';
import * as FirestoreService from '../firebase/firestoreService';
import { Vehicle } from '../utils/types';

// Mock firestoreService
jest.mock('../firebase/firestoreService', () => ({
  fetchUserVehicles: jest.fn(),
  fetchFuelLocations: jest.fn(),
}));

const mockAddDocFirestore = jest.fn();
jest.mock('firebase/firestore', () => {
    const originalModule = jest.requireActual('firebase/firestore');
    return {
        ...originalModule,
        addDoc: mockAddDocFirestore,
        Timestamp: {
            now: jest.fn(() => ({
                toDate: () => new Date(),
                toMillis: () => new Date().getTime(),
            })),
        },
        collection: jest.fn().mockImplementation((_db, path) => ({ path })),
        query: jest.fn(),
        where: jest.fn(),
        getDocs: jest.fn().mockResolvedValue({ docs: [] }),
    };
});


const mockUseAuth = jest.spyOn(AuthContext, 'useAuth');

const mockVehicles: Vehicle[] = [
  { id: 'v1', userId: 'user1', name: 'My Sedan', make: 'Honda', model: 'Civic' },
  { id: 'v2', userId: 'user1', name: 'Work Truck', make: 'Ford', model: 'F-150' },
];

const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/total cost/i), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText(/distance covered/i), { target: { value: '300' } });
  fireEvent.change(screen.getByLabelText(/fuel added/i), { target: { value: '40' } });
};

describe('QuickLogPage - Vehicle Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false } as any);
    (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValue([...mockVehicles]);

    Object.defineProperty(global.navigator, 'geolocation', {
        value: {
            getCurrentPosition: jest.fn().mockImplementationOnce((successCb) => successCb({
                coords: { latitude: 50, longitude: 50, accuracy: 10 }
            })),
            watchPosition: jest.fn(),
            clearWatch: jest.fn()
        },
        configurable: true
    });
  });

  it('fetches and displays vehicles in the dropdown', async () => {
    render(<BrowserRouter><QuickLogPage /></BrowserRouter>);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /select a vehicle/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /my sedan \(honda civic\)/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /work truck \(ford f-150\)/i })).toBeInTheDocument();
    });
    expect(FirestoreService.fetchUserVehicles).toHaveBeenCalled();
  });

  it('includes selected vehicleId in the log data on submit', async () => {
    mockAddDocFirestore.mockResolvedValueOnce({ id: 'newLog123' });
    render(<BrowserRouter><QuickLogPage /></BrowserRouter>);
    await waitFor(() => screen.getByRole('option', { name: /my sedan/i }));

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/vehicle/i), { target: { value: 'v1' } });
    fireEvent.click(screen.getByRole('button', { name: /save fuel log/i }));

    await waitFor(() => {
      expect(mockAddDocFirestore).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'fuelLogs' }),
        expect.objectContaining({ vehicleId: 'v1', userId: 'user1' })
      );
    });
  });

  it('submits log without vehicleId if no vehicle is selected', async () => {
    mockAddDocFirestore.mockResolvedValueOnce({ id: 'newLog456' });
    render(<BrowserRouter><QuickLogPage /></BrowserRouter>);
    await waitFor(() => screen.getByRole('option', { name: /my sedan/i }));

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /save fuel log/i }));

    await waitFor(() => {
      expect(mockAddDocFirestore).toHaveBeenCalled();
      const submittedData = mockAddDocFirestore.mock.calls[0][1];
      expect(submittedData).not.toHaveProperty('vehicleId');
      expect(submittedData).toHaveProperty('userId', 'user1');
    });
  });

  it('shows a message and link if no vehicles are available', async () => {
    (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValueOnce([]);
    render(<BrowserRouter><QuickLogPage /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText(/no vehicles found/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /add a vehicle/i })).toBeInTheDocument();
    });
  });

  it('allows log submission even if no vehicles are available', async () => {
    (FirestoreService.fetchUserVehicles as jest.Mock).mockResolvedValueOnce([]);
    mockAddDocFirestore.mockResolvedValueOnce({ id: 'newLog789' });
    render(<BrowserRouter><QuickLogPage /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText(/no vehicles found/i)).toBeInTheDocument());

    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: /save fuel log/i }));

    await waitFor(() => {
      expect(mockAddDocFirestore).toHaveBeenCalled();
      const submittedData = mockAddDocFirestore.mock.calls[0][1];
      expect(submittedData).not.toHaveProperty('vehicleId');
      expect(screen.getByText(/log saved successfully!/i)).toBeInTheDocument();
    });
  });

  it('shows loading state for vehicle dropdown', async () => {
    (FirestoreService.fetchUserVehicles as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    render(<BrowserRouter><QuickLogPage /></BrowserRouter>);
    await waitFor(() => expect(screen.getByText(/loading your vehicles.../i)).toBeInTheDocument());
  });

});
