import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Timestamp } from 'firebase/firestore';
import DashboardPage from './DashboardPage';
import { fetchLogsSince } from '../data/logs';
import { fetchVehicles } from '../data/vehicles';
import type { Log, Vehicle } from '../utils/types';

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

const mockGetLifetimeStats = vi.fn().mockResolvedValue({ totalCost: 0, totalLitres: 0, totalDistanceKm: 0, logCount: 0 });
vi.mock('../firebase/aggregationService', () => ({
  getLifetimeStats: (...args: unknown[]) => mockGetLifetimeStats(...args),
}));

vi.mock('../firebase/config', () => ({ db: {} }));

// The page reads through the data layer; mock its query functions.
vi.mock('../data/logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/logs')>();
  return { ...actual, fetchLogsSince: vi.fn() };
});
vi.mock('../data/vehicles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/vehicles')>();
  return { ...actual, fetchVehicles: vi.fn() };
});

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

const log = (id: string, cost: number, distanceKm: number, fuelAmountLiters: number) => ({
  id, userId: 'user-1', timestamp: Timestamp.fromDate(new Date()), cost, distanceKm, fuelAmountLiters,
}) as unknown as Log;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><DashboardPage /></QueryClientProvider>);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLifetimeStats.mockResolvedValue({ totalCost: 0, totalLitres: 0, totalDistanceKm: 0, logCount: 0 });
    vi.mocked(fetchVehicles).mockResolvedValue([]);
    vi.mocked(fetchLogsSince).mockResolvedValue([]);
  });

  it('renders the empty state when the user has no logs', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('No fuel logs yet')).toBeInTheDocument());
    expect(screen.queryByText(/Failed to load/)).not.toBeInTheDocument();
  });

  it('reads the last six months of logs for the user', async () => {
    renderPage();
    await waitFor(() => expect(fetchLogsSince).toHaveBeenCalled());
    const [uid, since, vehicleId] = vi.mocked(fetchLogsSince).mock.calls[0];
    expect(uid).toBe('user-1');
    const now = new Date();
    expect(since).toEqual(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    expect(vehicleId).toBeUndefined();
  });

  it('shows accurate current-month cost, litres, and avg price/litre cards', async () => {
    vi.mocked(fetchLogsSince).mockResolvedValue([log('log1', 50, 400, 25), log('log2', 30, 200, 15)]);

    renderPage();

    await waitFor(() => expect(screen.getByText('€80.00')).toBeInTheDocument());
    expect(screen.getByText('40.0L')).toBeInTheDocument();
    // avg price/litre = 80 / 40 = 2.000
    expect(screen.getByText('€2.000')).toBeInTheDocument();
  });

  it('shows an error banner when fetching logs fails', async () => {
    vi.mocked(fetchLogsSince).mockRejectedValue(new Error('Firestore error'));

    renderPage();

    await waitFor(() => expect(screen.getByText('Failed to load dashboard data. Please try again.')).toBeInTheDocument());
  });

  it('shows an error banner when fetching vehicles fails', async () => {
    vi.mocked(fetchVehicles).mockRejectedValue(new Error('Firestore error'));

    renderPage();

    await waitFor(() => expect(screen.getByText('Failed to load dashboard data. Please try again.')).toBeInTheDocument());
  });

  it('renders lifetime stats and the MPG/price trend chart when enough logs exist', async () => {
    mockGetLifetimeStats.mockResolvedValue({ totalCost: 123.45, totalLitres: 67.8, totalDistanceKm: 910, logCount: 12 });
    vi.mocked(fetchLogsSince).mockResolvedValue([log('log1', 50, 400, 25), log('log2', 30, 200, 15)]);

    renderPage();

    await waitFor(() => expect(screen.getByText('€123.45')).toBeInTheDocument());
    expect(screen.getByText('67.8L')).toBeInTheDocument();
    expect(screen.getByText('910km')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // MPG/price trend plus cost-per-litre trend.
    expect(screen.getAllByTestId('line-chart')).toHaveLength(2);
  });

  it('renders the multi-vehicle comparison chart when two vehicles have stats', async () => {
    const vehicles = [
      { id: 'v1', name: 'Car 1', make: 'Toyota', userId: 'user-1', isArchived: false },
      { id: 'v2', name: 'Car 2', make: 'Honda', userId: 'user-1', isArchived: false },
    ] as unknown as Vehicle[];
    mockGetLifetimeStats.mockImplementation((_uid: string, vehicleId?: string) => {
      if (vehicleId === 'v1') return Promise.resolve({ totalCost: 100, totalLitres: 50, totalDistanceKm: 500, logCount: 5 });
      if (vehicleId === 'v2') return Promise.resolve({ totalCost: 200, totalLitres: 80, totalDistanceKm: 800, logCount: 8 });
      return Promise.resolve({ totalCost: 0, totalLitres: 0, totalDistanceKm: 0, logCount: 0 });
    });
    vi.mocked(fetchVehicles).mockResolvedValue(vehicles);
    vi.mocked(fetchLogsSince).mockResolvedValue([log('log1', 50, 400, 25)]);

    renderPage();

    await waitFor(() => expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(1));
  });

  it('renders the cost-per-litre chart when there are two or more logs', async () => {
    vi.mocked(fetchLogsSince).mockResolvedValue([log('log1', 50, 400, 25), log('log2', 30, 200, 15)]);

    renderPage();

    await waitFor(() => expect(screen.getAllByTestId('line-chart').length).toBe(2));
  });
});
