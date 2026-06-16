// src/components/__tests__/StationDetail.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StationDetail from '../StationDetail';
import { Log } from '../../utils/types';
import { Timestamp } from 'firebase/firestore';
import { fetchFuelLogsByStationId, fetchStationById } from '../../firebase/firestoreService'; // Import the actual function for type inference with vi.mocked

// Mock firebase/firestoreService
vi.mock('../../firebase/firestoreService', () => ({
  fetchFuelLogsByStationId: vi.fn(), // Initially mock as a simple fn
  fetchStationById: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'stationDetail.loading': 'Loading station details...',
        'stationDetail.errorLoading': 'Failed to load station details.',
        'stationDetail.noData': 'No station data available.',
        'stationDetail.unknownBrand': 'Unknown Brand',
        'stationDetail.avgPrice': 'Average Price',
        'stationDetail.lastPrice': 'Last Price',
        'stationDetail.logCount': 'Total Logs',
        'stationDetail.priceHistory': 'Price History (per Litre)',
        'stationDetail.chartAxisDate': 'Fill Date',
        'stationDetail.chartAxisPrice': 'Price per Litre',
        'stationDetail.notEnoughDataForChart': 'Not enough data to display chart.',
        'stationDetail.recentLogs': 'Recent Logs',
        'stationDetail.noLogsFound': 'No fuel logs found for this station.',
        'stationTable.noData': 'N/A', // from stationTable, used by stationDetail
      };
      return translations[key] || key;
    },
  }),
}));

// Mock Recharts components (simplified)
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

const mockStationId = 'testStation1';
const mockLogs: Log[] = [
  {
    id: 'log1',
    userId: 'user1',
    timestamp: Timestamp.fromDate(new Date('2023-01-01T12:00:00')),
    brand: 'Shell',
    cost: 50,
    distanceKm: 500,
    fuelAmountLiters: 40,
    stationId: mockStationId,
  },
  {
    id: 'log2',
    userId: 'user1',
    timestamp: Timestamp.fromDate(new Date('2023-02-01T12:00:00')),
    brand: 'Shell',
    cost: 60,
    distanceKm: 600,
    fuelAmountLiters: 45,
    stationId: mockStationId,
  },
];

describe('StationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchFuelLogsByStationId).mockReset(); // Reset the mock before each test
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue([]); // Default mock implementation
    vi.mocked(fetchStationById).mockReset();
    vi.mocked(fetchStationById).mockResolvedValue(null); // No stored station doc by default — falls back to log-derived stats
  });

  it('renders loading state initially', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockReturnValue(new Promise(() => {})); // Never resolve
    render(<StationDetail stationId={mockStationId} />);
    expect(screen.getByText('Loading station details...')).toBeInTheDocument();
    await waitFor(() => {
        expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });
  });

  it('renders error state if fetching logs fails', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockRejectedValue(new Error('Fetch failed'));
    render(<StationDetail stationId={mockStationId} />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load station details.')).toBeInTheDocument();
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    });
  });

  it('renders "no station data" if no logs are found', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue([]);
    render(<StationDetail stationId={mockStationId} />);
    await waitFor(() => {
      expect(screen.getByText('No station data available.')).toBeInTheDocument();
    });
  });

  it('renders station details and fuel logs correctly', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue(mockLogs);
    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Shell' })).toBeInTheDocument(); // Station name
      expect(screen.getByText('Average Price')).toBeInTheDocument();
      expect(screen.getByText('€1.292/L')).toBeInTheDocument(); // (1.25 + 1.333) / 2 = 1.2915 => 1.292
      expect(screen.getByText('Last Price')).toBeInTheDocument();
      expect(screen.getByText('€1.250/L')).toBeInTheDocument(); // 50/40 = 1.25
      expect(screen.getByText('Total Logs')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Price History (per Litre)' })).toBeInTheDocument();
      expect(screen.getByText('Recent Logs')).toBeInTheDocument();
      expect(screen.getByText('€50.00 (40.00L @ 1.250/L)')).toBeInTheDocument();
      expect(screen.getByText('€60.00 (45.00L @ 1.333/L)')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument(); // Recharts mocked component
      expect(screen.getByTestId('line-chart')).toBeInTheDocument(); // Recharts mocked component
    });
  });

  it('renders "Not enough data for chart" if only one log is found', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue([mockLogs[0]]);
    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      expect(screen.getByText('Not enough data to display chart.')).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  it('handles station with no brand correctly', async () => {
    const logWithoutBrand: Log[] = [
      {
        ...mockLogs[0],
        brand: undefined, // No brand
      },
    ];
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue(logWithoutBrand);
    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      expect(screen.getByText('Unknown Station')).toBeInTheDocument(); // Fallback name
      expect(screen.getByText('Unknown Brand')).toBeInTheDocument(); // Fallback brand
    });
  });

  it('handles logs with zero fuelAmountLiters gracefully', async () => {
    const logsWithZeroFuel: Log[] = [
      {
        ...mockLogs[0],
        fuelAmountLiters: 0,
      },
    ];
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue(logsWithZeroFuel);
    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      expect(screen.getAllByText('No station data available.')).toHaveLength(2); // Avg price and Last price
      expect(screen.getByText('Not enough data to display chart.')).toBeInTheDocument();
      expect(screen.getByText('€50.00 (0.00L @ N/A/L)')).toBeInTheDocument();
    });
  });

  it('still renders log-derived data when fetching the station document fails', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue(mockLogs);
    vi.mocked(fetchStationById).mockRejectedValue(new Error('station doc fetch failed'));

    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      // Falls back to log-derived stats rather than discarding the successfully-fetched logs
      expect(screen.getByRole('heading', { name: 'Shell' })).toBeInTheDocument();
      expect(screen.getByText('€50.00 (40.00L @ 1.250/L)')).toBeInTheDocument();
      expect(screen.queryByText('Failed to load station details.')).not.toBeInTheDocument();
    });
  });

  it('renders an accessible screen-reader data table alongside the chart', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue(mockLogs);
    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('Fill Date')).toBeInTheDocument();
      expect(within(table).getByText('Price per Litre')).toBeInTheDocument();
      expect(within(table).getAllByRole('row')).toHaveLength(3); // header + 2 data rows
    });
  });

  it('prefers the stored station document over log-derived stats when available', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue(mockLogs);
    vi.mocked(fetchStationById).mockResolvedValue({
      id: mockStationId,
      osmId: 'node/123',
      name: 'Shell Lifetime Name',
      brand: 'Shell',
      latitude: 1,
      longitude: 2,
      logCount: 47, // Lifetime count, larger than the 2 fetched recent logs
      avgPrice: 1.4,
      lastPrice: 1.45,
    });

    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Shell Lifetime Name' })).toBeInTheDocument();
      expect(screen.getByText('47')).toBeInTheDocument();
      expect(screen.getByText('€1.400/L')).toBeInTheDocument();
      expect(screen.getByText('€1.450/L')).toBeInTheDocument();
    });
  });

  it('requests only the most recent logs, not the full history', async () => {
    vi.mocked(fetchFuelLogsByStationId).mockResolvedValue(mockLogs);
    render(<StationDetail stationId={mockStationId} />);

    await waitFor(() => {
      expect(fetchFuelLogsByStationId).toHaveBeenCalledWith(mockStationId, 12);
    });
  });
});
