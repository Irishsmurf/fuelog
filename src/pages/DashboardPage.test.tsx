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
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
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
});
