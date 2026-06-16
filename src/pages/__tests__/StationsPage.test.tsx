// src/pages/__tests__/StationsPage.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StationsPage from '../StationsPage';
import { Station } from '../../utils/types';
import { fetchFuelLocations, fetchUserStations } from '../../firebase/firestoreService';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'stations.title': 'Fuel Stations',
        'stations.loading': 'Loading fuel stations...',
        'stations.errorLoading': 'Failed to load fuel stations.',
        'stations.noStationsFound': 'No fuel stations found.',
        'stations.selectStationPrompt': 'Select a station from the left to view details.',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock firebase/firestoreService
vi.mock('../../firebase/firestoreService', () => ({
  fetchFuelLocations: vi.fn(),
  fetchUserStations: vi.fn(),
}));

// Mock StationTable and StationDetail components
vi.mock('../../components/StationTable', () => ({
  default: vi.fn(({ stations, onSelectStation, selectedStationId }) => (
    <div data-testid="station-table">
      {stations.map((station: Station) => (
        <div key={station.id} data-testid={`station-item-${station.id}`} onClick={() => onSelectStation(station.id)}>
          {station.name} {selectedStationId === station.id && '(Selected)'}
        </div>
      ))}
    </div>
  )),
}));
vi.mock('../../components/StationDetail', () => ({
  default: vi.fn(({ stationId }) => (
    <div data-testid="station-detail">Station Detail for {stationId}</div>
  )),
}));

const mockStations: Station[] = [
  {
    id: 'station1',
    osmId: 'osm1',
    name: 'Shell A',
    brand: 'Shell',
    latitude: 10,
    longitude: 20,
    lastPrice: 1.5,
    avgPrice: 1.45,
    logCount: 10,
  },
  {
    id: 'station2',
    osmId: 'osm2',
    name: 'Maxol B',
    brand: 'Maxol',
    latitude: 11,
    longitude: 21,
    lastPrice: 1.6,
    avgPrice: 1.55,
    logCount: 5,
  },
];

describe('StationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchFuelLocations).mockResolvedValue([]);
    vi.mocked(fetchUserStations).mockResolvedValue([]); // Default to no stations
  });

  it('renders loading state initially', () => {
    vi.mocked(fetchUserStations).mockReturnValue(new Promise(() => {})); // Never resolve
    render(<StationsPage />);
    expect(screen.getByText('Loading fuel stations...')).toBeInTheDocument();
    // Assuming Loader component also uses data-testid or has an accessible role
    // For now, checking text, if icon is separate, will need to adapt.
  });

  it('renders error state if fetching stations fails', async () => {
    vi.mocked(fetchUserStations).mockRejectedValue(new Error('Fetch failed'));
    render(<StationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load fuel stations.')).toBeInTheDocument();
    });
  });

  it('renders "no stations found" if fetchUserStations returns empty array', async () => {
    vi.mocked(fetchUserStations).mockResolvedValue([]);
    render(<StationsPage />);
    await waitFor(() => {
      expect(screen.getByText('No fuel stations found.')).toBeInTheDocument();
    });
  });

  it('fetches fuel logs and passes them to fetchUserStations', async () => {
    const mockLogs = [{ id: 'log1', latitude: 10, longitude: 20 }] as never;
    vi.mocked(fetchFuelLocations).mockResolvedValue(mockLogs);
    vi.mocked(fetchUserStations).mockResolvedValue(mockStations);
    render(<StationsPage />);
    await waitFor(() => {
      expect(fetchFuelLocations).toHaveBeenCalled();
      expect(fetchUserStations).toHaveBeenCalledWith(mockLogs);
    });
  });

  it('renders list of stations and prompt to select a station', async () => {
    vi.mocked(fetchUserStations).mockResolvedValue(mockStations);
    render(<StationsPage />);
    await waitFor(() => {
      expect(screen.getByText('Fuel Stations')).toBeInTheDocument();
      expect(screen.getByTestId('station-table')).toBeInTheDocument();
      expect(screen.getByText('Shell A')).toBeInTheDocument();
      expect(screen.getByText('Maxol B')).toBeInTheDocument();
      expect(screen.getByText('Select a station from the left to view details.')).toBeInTheDocument();
      expect(screen.queryByTestId('station-detail')).not.toBeInTheDocument();
    });
  });

  it('renders StationDetail when a station is selected', async () => {
    vi.mocked(fetchUserStations).mockResolvedValue(mockStations);
    render(<StationsPage />);
    await waitFor(() => {
      fireEvent.click(screen.getByText('Shell A'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('station-detail')).toBeInTheDocument();
      expect(screen.getByText('Station Detail for station1')).toBeInTheDocument();
      expect(screen.getByText('Shell A (Selected)')).toBeInTheDocument();
    });
  });
});
