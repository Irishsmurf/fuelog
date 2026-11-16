import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HistoryPage from '../HistoryPage';
import { fetchLogsPage, fetchAllLogs } from '../../data/logs';
import { exportLogsToPDF } from '../../utils/pdfExport';
import type { Log } from '../../utils/types';

const mockT = (key: string, opts?: Record<string, unknown>) =>
  (opts && 'defaultValue' in opts ? (opts.defaultValue as string) : key);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
const auth = vi.hoisted(() => ({ user: { uid: 'u1', email: 'a@b.c' }, profile: { homeCurrency: 'EUR' } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../context/RemoteConfigContext', () => ({ useRemoteConfig: () => ({ getBoolean: () => false }) }));
vi.mock('../../firebase/config', () => ({ db: {} }));
vi.mock('../../firebase/firestoreService', () => ({
  fetchUserStations: vi.fn().mockResolvedValue([]),
  fetchVehicles: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../utils/pdfExport', () => ({ exportLogsToPDF: vi.fn() }));
vi.mock('../../components/LogCard', () => ({ default: () => <div data-testid="log-card" /> }));
vi.mock('../../components/LocationPicker', () => ({ default: () => null }));
vi.mock('../../components/ImageUpload', () => ({ default: () => null }));
vi.mock('../../components/ReceiptModal', () => ({ default: () => null }));
vi.mock('../../data/logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/logs')>();
  return { ...actual, fetchLogsPage: vi.fn(), fetchAllLogs: vi.fn() };
});

const ts = (d: string) => ({ toDate: () => new Date(d), toMillis: () => new Date(d).getTime() });
const log = (id: string, brand = 'Esso') => ({
  id, userId: 'u1', timestamp: ts('2026-11-01T10:00:00Z'), brand, cost: 50, distanceKm: 400, fuelAmountLiters: 30,
}) as unknown as Log;
const cursor = { id: 'cursor-1' };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><HistoryPage /></QueryClientProvider>);
}

describe('HistoryPage (data layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
  });

  it('shows the first page and loads the next one from the returned cursor', async () => {
    vi.mocked(fetchLogsPage)
      .mockResolvedValueOnce({ logs: [log('a'), log('b')], nextCursor: cursor as never, brands: ['Esso'] })
      .mockResolvedValueOnce({ logs: [log('c')], nextCursor: null, brands: ['Esso'] });
    renderPage();

    const loadMore = await screen.findByRole('button', { name: 'Load More' });
    fireEvent.click(loadMore);

    await waitFor(() => expect(fetchLogsPage).toHaveBeenCalledTimes(2));
    expect(vi.mocked(fetchLogsPage).mock.calls[1][2]).toBe(cursor);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument());
  });

  it('exports every matching log, not just the loaded page', async () => {
    vi.mocked(fetchLogsPage).mockResolvedValue({ logs: [log('a')], nextCursor: cursor as never, brands: ['Esso'] });
    const all = Array.from({ length: 120 }, (_, i) => log(`l${i}`));
    vi.mocked(fetchAllLogs).mockResolvedValue({ logs: all as never, truncated: false });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /exportPdf/ }));

    await waitFor(() => expect(exportLogsToPDF).toHaveBeenCalled());
    expect(fetchAllLogs).toHaveBeenCalledWith('u1', expect.any(Object));
    expect(vi.mocked(exportLogsToPDF).mock.calls[0][0]).toHaveLength(120);
  });

  it('skips the extra fetch when everything is already loaded', async () => {
    vi.mocked(fetchLogsPage).mockResolvedValue({ logs: [log('a'), log('b')], nextCursor: null, brands: ['Esso'] });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /exportPdf/ }));

    await waitFor(() => expect(exportLogsToPDF).toHaveBeenCalled());
    expect(fetchAllLogs).not.toHaveBeenCalled();
    expect(vi.mocked(exportLogsToPDF).mock.calls[0][0]).toHaveLength(2);
  });

  it('passes the brand filter to the query instead of filtering loaded rows', async () => {
    vi.mocked(fetchLogsPage).mockResolvedValue({ logs: [log('a', 'Esso'), log('b', 'Shell')], nextCursor: null, brands: ['Esso', 'Shell'] });
    renderPage();
    await screen.findByRole('button', { name: /exportPdf/ });

    const brandSelect = screen.getByLabelText('history.filters.brand');
    await waitFor(() => expect(brandSelect.querySelector('option[value="Shell"]')).not.toBeNull());
    fireEvent.change(brandSelect, { target: { value: 'Shell' } });

    await waitFor(() => {
      const calls = vi.mocked(fetchLogsPage).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toMatchObject({ brand: 'Shell' });
    });
  });
});
