// src/components/FuelMapPage.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter as Router } from 'react-router-dom'; // For Link component
import FuelMapPage from './FuelMapPage';
import * as AuthContext from '../context/AuthContext';
import * as FirestoreService from '../firebase/firestoreService';
import { Log, Vehicle } from '../utils/types';
import { Timestamp } from 'firebase/firestore';

// Mock Leaflet and react-leaflet components
jest.mock('react-leaflet', () => ({
  ...jest.requireActual('react-leaflet'), // Keep original exports
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer"></div>,
  Marker: ({ children, position }: { children: React.ReactNode, position: any }) => (
    <div data-testid="marker" data-latitude={position[0]} data-longitude={position[1]}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ // Mock for useMap hook used by FitBoundsToMarkers
    fitBounds: jest.fn(),
    getZoom: jest.fn(() => 7), // Default zoom
    getBounds: jest.fn(() => ({ contains: jest.fn(() => true) })), // Mock getBounds
    setView: jest.fn(),
  }),
}));

jest.mock('react-leaflet-markercluster', () => ({ children }: { children: React.ReactNode }) => (
  <div data-testid="marker-cluster-group">{children}</div>
));


// Mock firestoreService
const mockFetchFuelLocations = FirestoreService.fetchFuelLocations as jest.Mock;
const mockFetchUserVehicles = FirestoreService.fetchUserVehicles as jest.Mock;

jest.mock('../firebase/firestoreService', () => ({
  fetchFuelLocations: jest.fn(),
  fetchUserVehicles: jest.fn(),
}));

// Mock useAuth
const mockUseAuth = AuthContext.useAuth as jest.Mock;
jest.mock('../context/AuthContext');

// Mock Timestamp.now() for consistent Timestamps in mock data
const mockTimestampNow = {
    toDate: () => new Date(), // Or a fixed date for more predictability
    toMillis: () => Date.now(),
    // Add other methods if your code uses them from Timestamp instances
} as Timestamp;


const mockLogs: Log[] = [
  { id: 'log1', userId: 'user1', brand: 'Shell', cost: 50, distanceKm: 300, fuelAmountLiters: 40, timestamp: mockTimestampNow, latitude: 53.1, longitude: -6.1, vehicleId: 'v1' },
  { id: 'log2', userId: 'user1', brand: 'Esso', cost: 60, distanceKm: 350, fuelAmountLiters: 45, timestamp: mockTimestampNow, latitude: 53.2, longitude: -6.2, vehicleId: 'v2' },
  { id: 'log3', userId: 'user1', brand: 'Circle K', cost: 55, distanceKm: 320, fuelAmountLiters: 42, timestamp: mockTimestampNow, latitude: 53.3, longitude: -6.3, vehicleId: 'v1' },
  { id: 'log4', userId: 'user1', brand: 'Maxol', cost: 70, distanceKm: 400, fuelAmountLiters: 50, timestamp: mockTimestampNow, latitude: 53.4, longitude: -6.4 }, // No vehicleId
  { id: 'log5', userId: 'user1', brand: 'Applegreen', cost: 65, distanceKm: 380, fuelAmountLiters: 48, timestamp: mockTimestampNow /* No lat/lng */ },
];

const mockVehicles: Vehicle[] = [
  { id: 'v1', userId: 'user1', name: 'My Sedan', make: 'Toyota', model: 'Camry' },
  { id: 'v2', userId: 'user1', name: 'Work Truck', make: 'Ford', model: 'F-150' },
];


describe('FuelMapPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' } });
    // Default to returning logs that have coordinates
    mockFetchFuelLocations.mockResolvedValue([...mockLogs.filter(l => l.latitude && l.longitude)]);
    mockFetchUserVehicles.mockResolvedValue([...mockVehicles]);
  });

  it('renders loading state initially', async () => {
    mockFetchFuelLocations.mockImplementationOnce(() => new Promise(() => {}));
    mockFetchUserVehicles.mockImplementationOnce(() => new Promise(() => {}));
    render(<Router><FuelMapPage /></Router>);
    expect(screen.getByText(/loading map data.../i)).toBeInTheDocument();
  });

  it('renders error state if fetching locations fails', async () => {
    mockFetchFuelLocations.mockRejectedValue(new Error('Failed to fetch locations'));
    render(<Router><FuelMapPage /></Router>);
    await waitFor(() => {
      expect(screen.getByText(/failed to load locations./i)).toBeInTheDocument();
    });
  });

  it('renders "no locations" message if no valid locations are found', async () => {
    mockFetchFuelLocations.mockResolvedValue([]);
    render(<Router><FuelMapPage /></Router>);
    await waitFor(() => {
      // This message appears when filteredMapLocations is empty AND loading is false.
      // fetchUserVehicles might still be loading if not awaited properly or if it resolves after locations.
      // Ensure vehicles are also "loaded" (even if empty) for this specific message to show.
      mockFetchUserVehicles.mockResolvedValueOnce([]); // Ensure vehicles are also resolved
      expect(screen.getByText(/no fuel locations with coordinates found./i)).toBeInTheDocument();
    });
  });


  it('renders the map with markers when data is loaded', async () => {
    render(<Router><FuelMapPage /></Router>);
    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
      expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
      expect(screen.getByTestId('marker-cluster-group')).toBeInTheDocument();
      const markers = screen.getAllByTestId('marker');
      expect(markers).toHaveLength(mockLogs.filter(l => l.latitude && l.longitude).length);
    });
  });

  it('renders vehicle filter dropdown', async () => {
    render(<Router><FuelMapPage /></Router>);
    await waitFor(() => {
        expect(screen.getByLabelText(/filter by vehicle/i)).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'All Vehicles' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /my sedan \(toyota camry\)/i })).toBeInTheDocument();
    });
  });

  describe('Vehicle Filtering on Map', () => {
    beforeEach(async () => {
        render(<Router><FuelMapPage /></Router>);
        await waitFor(() => {
            expect(screen.getByLabelText(/filter by vehicle/i)).toBeInTheDocument();
            expect(screen.getAllByTestId('marker')).toHaveLength(mockLogs.filter(l => l.latitude && l.longitude).length);
        });
    });

    it('filters markers when a specific vehicle is selected', async () => {
        fireEvent.change(screen.getByLabelText(/filter by vehicle/i), { target: { value: 'v1' } });

        await waitFor(() => {
            const markers = screen.getAllByTestId('marker');
            expect(markers).toHaveLength(2);
            // Check marker by latitude (unique enough for this mock data)
            expect(screen.getByTestId('marker', { selector: '[data-latitude="53.1"]' })).toBeInTheDocument();
            expect(screen.getByTestId('marker', { selector: '[data-latitude="53.3"]' })).toBeInTheDocument();
            expect(screen.queryByTestId('marker', { selector: '[data-latitude="53.2"]' })).not.toBeInTheDocument();
        });
    });

    it('shows all valid markers when "All Vehicles" is selected after a filter', async () => {
        fireEvent.change(screen.getByLabelText(/filter by vehicle/i), { target: { value: 'v1' } });
        await waitFor(() => expect(screen.getAllByTestId('marker')).toHaveLength(2));

        fireEvent.change(screen.getByLabelText(/filter by vehicle/i), { target: { value: '' } });
        await waitFor(() => {
            expect(screen.getAllByTestId('marker')).toHaveLength(mockLogs.filter(l => l.latitude && l.longitude).length);
        });
    });

    it('updates marker popups with vehicle name when filtered', async () => {
        mockFetchFuelLocations.mockResolvedValueOnce([mockLogs[0]]); // log1 (v1)
        mockFetchUserVehicles.mockResolvedValueOnce([mockVehicles[0]]); // v1 (My Sedan)

        render(<Router><FuelMapPage /></Router>); // Re-render with specific mocks for this test

        await waitFor(() => {
            expect(screen.getByTestId('marker')).toBeInTheDocument();
        });

        // The popup content is inside the marker.
        const markerForV1 = screen.getByTestId('marker', { selector: '[data-latitude="53.1"]' });
        expect(markerForV1).toBeInTheDocument();

        // Check for popup content within this specific marker
        const popupContent = within(markerForV1).getByTestId('popup');
        expect(popupContent).toHaveTextContent('Date:');
        expect(popupContent).toHaveTextContent(`Vehicle: ${mockVehicles[0].name}`);
    });

    it('shows "no locations found for selected vehicle" when filter results in no markers', async () => {
        // Provide initial logs that DO NOT match the vehicle we will filter by
        mockFetchFuelLocations.mockResolvedValueOnce([mockLogs[3]]); // log4 (no vehicleId)
        // Provide vehicles so the filter option is available
        mockFetchUserVehicles.mockResolvedValueOnce([mockVehicles[0]]); // Vehicle v1 is an option

        render(<Router><FuelMapPage /></Router>);

        await waitFor(() => {
            expect(screen.getByLabelText(/filter by vehicle/i)).toBeInTheDocument();
            // Initially, one marker (log4)
            expect(screen.getAllByTestId('marker')).toHaveLength(1);
        });

        fireEvent.change(screen.getByLabelText(/filter by vehicle/i), { target: { value: 'v1' } }); // Select 'My Sedan' (v1)

        await waitFor(() => {
            expect(screen.getByText(/no locations found for the selected vehicle/i)).toBeInTheDocument();
            expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
        });
    });

  });
});

// Helper to query within an element, useful for popups inside markers
import { within } from '@testing-library/dom';
