import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocs } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import DashboardPage from './DashboardPage';

const mockT = (key: string, opts?: Record<string, unknown>) => {
  if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

const mockUser = { uid: 'user-1' };
const mockProfile = { homeCurrency: 'EUR' };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, profile: mockProfile }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const mockGetBoolean = vi.fn<(key: string) => boolean>(() => false);
vi.mock('../context/RemoteConfigContext', () => ({
  useRemoteConfig: () => ({ getBoolean: mockGetBoolean }),
}));

const mockGetLifetimeStats = vi.fn().mockResolvedValue({ totalCost: 0, totalLitres: 0, totalDistanceKm: 0, logCount: 0 });
vi.mock('../firebase/aggregationService', () => ({
  getLifetimeStats: (...args: unknown[]) => mockGetLifetimeStats(...args),
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(),
  };
});

vi.mock('../firebase/config', () => ({
  db: {},
}));

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children?: ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  LineChart: ({ children }: { children?: ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

function mockSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return {
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      docs.forEach(d => cb({ id: d.id, data: () => d.data }));
    },
  };
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBoolean.mockReturnValue(false);
    mockGetLifetimeStats.mockResolvedValue({ totalCost: 0, totalLitres: 0, totalDistanceKm: 0, logCount: 0 });
  });

  it('renders the empty state when the user has no logs', async () => {
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot([]) as never);

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('No fuel logs yet')).toBeInTheDocument());
    expect(screen.queryByText(/Failed to load/)).not.toBeInTheDocument();
  });

  it('shows accurate current-month cost, litres, and avg price/litre cards', async () => {
    const now = new Date();
    vi.mocked(getDocs)
      .mockResolvedValueOnce(mockSnapshot([]) as never) // vehicles
      .mockResolvedValueOnce(mockSnapshot([
        {
          id: 'log1',
          data: {
            userId: 'user-1',
            timestamp: Timestamp.fromDate(now),
            cost: 50,
            distanceKm: 400,
            fuelAmountLiters: 25,
          },
        },
        {
          id: 'log2',
          data: {
            userId: 'user-1',
            timestamp: Timestamp.fromDate(now),
            cost: 30,
            distanceKm: 200,
            fuelAmountLiters: 15,
          },
        },
      ]) as never); // logs

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('€80.00')).toBeInTheDocument());
    expect(screen.getByText('40.0L')).toBeInTheDocument();
    // avg price/litre = 80 / 40 = 2.000
    expect(screen.getByText('€2.000')).toBeInTheDocument();
  });

  it('shows an error banner when fetching logs fails', async () => {
    vi.mocked(getDocs)
      .mockResolvedValueOnce(mockSnapshot([]) as never) // vehicles
      .mockRejectedValueOnce(new Error('Firestore error')); // logs

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Failed to load dashboard data. Please try again.')).toBeInTheDocument());
  });

  it('shows an error banner when fetching vehicles fails', async () => {
    vi.mocked(getDocs)
      .mockRejectedValueOnce(new Error('Firestore error')) // vehicles
      .mockResolvedValueOnce(mockSnapshot([]) as never); // logs

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Failed to load dashboard data. Please try again.')).toBeInTheDocument());
  });

  it('renders lifetime stats and the MPG/price trend chart when enough logs exist', async () => {
    const now = new Date();
    mockGetLifetimeStats.mockResolvedValue({ totalCost: 123.45, totalLitres: 67.8, totalDistanceKm: 910, logCount: 12 });
    vi.mocked(getDocs)
      .mockResolvedValueOnce(mockSnapshot([]) as never) // vehicles
      .mockResolvedValueOnce(mockSnapshot([
        { id: 'log1', data: { userId: 'user-1', timestamp: Timestamp.fromDate(now), cost: 50, distanceKm: 400, fuelAmountLiters: 25 } },
        { id: 'log2', data: { userId: 'user-1', timestamp: Timestamp.fromDate(now), cost: 30, distanceKm: 200, fuelAmountLiters: 15 } },
      ]) as never); // logs

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('€123.45')).toBeInTheDocument());
    expect(screen.getByText('67.8L')).toBeInTheDocument();
    expect(screen.getByText('910km')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders the multi-vehicle comparison chart when the feature flag is enabled and stats exist', async () => {
    mockGetBoolean.mockImplementation((key: string): boolean => key === 'vehicleComparisonEnabled');
    const now = new Date();
    const vehicles = [
      { id: 'v1', name: 'Car 1', make: 'Toyota', userId: 'user-1', isArchived: false },
      { id: 'v2', name: 'Car 2', make: 'Honda', userId: 'user-1', isArchived: false },
    ];
    mockGetLifetimeStats.mockImplementation((_uid: string, vehicleId?: string) => {
      if (vehicleId === 'v1') return Promise.resolve({ totalCost: 100, totalLitres: 50, totalDistanceKm: 500, logCount: 5 });
      if (vehicleId === 'v2') return Promise.resolve({ totalCost: 200, totalLitres: 80, totalDistanceKm: 800, logCount: 8 });
      return Promise.resolve({ totalCost: 0, totalLitres: 0, totalDistanceKm: 0, logCount: 0 });
    });
    vi.mocked(getDocs)
      .mockResolvedValueOnce(mockSnapshot(vehicles.map(v => ({ id: v.id, data: v }))) as never) // vehicles
      .mockResolvedValueOnce(mockSnapshot([
        { id: 'log1', data: { userId: 'user-1', timestamp: Timestamp.fromDate(now), cost: 50, distanceKm: 400, fuelAmountLiters: 25 } },
      ]) as never); // logs

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(1));
  });

  it('renders the cost-per-litre chart when its feature flag is enabled', async () => {
    mockGetBoolean.mockImplementation((key: string): boolean => key === 'costPerLitreGraphEnabled');
    const now = new Date();
    vi.mocked(getDocs)
      .mockResolvedValueOnce(mockSnapshot([]) as never) // vehicles
      .mockResolvedValueOnce(mockSnapshot([
        { id: 'log1', data: { userId: 'user-1', timestamp: Timestamp.fromDate(now), cost: 50, distanceKm: 400, fuelAmountLiters: 25 } },
        { id: 'log2', data: { userId: 'user-1', timestamp: Timestamp.fromDate(now), cost: 30, distanceKm: 200, fuelAmountLiters: 15 } },
      ]) as never); // logs

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getAllByTestId('line-chart').length).toBe(2));
  });
});
