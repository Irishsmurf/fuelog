import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HistoryPage from '../HistoryPage';
import { fetchLogsPage, fetchAllLogs, updateLog } from '../../data/logs';
import { exportLogsToPDF } from '../../utils/pdfExport';
import type { Log } from '../../utils/types';

const mockT = (key: string, opts?: Record<string, unknown>) =>
  (opts && 'defaultValue' in opts ? (opts.defaultValue as string) : key);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
const auth = vi.hoisted(() => ({ user: { uid: 'u1', email: 'a@b.c' }, profile: { homeCurrency: 'EUR' } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
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
  return { ...actual, fetchLogsPage: vi.fn(), fetchAllLogs: vi.fn(), updateLog: vi.fn().mockResolvedValue(undefined) };
});

const ts = (d: string) => ({ toDate: () => new Date(d), toMillis: () => new Date(d).getTime() });
const log = (id: string, brand = 'Esso') => ({
  id, userId: 'u1', timestamp: ts('2026-11-01T10:00:00Z'), brand, cost: 50, distanceKm: 400, fuelAmountLiters: 30,
}) as unknown as Log;
const cursor = { id: 'cursor-1' };

/** The export button renders (disabled) before the first page loads. */
async function enabledExportButton() {
  const button = await screen.findByRole('button', { name: /exportPdf/ });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

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

  it('keeps every seen brand in the filter while a brand is selected', async () => {
    vi.mocked(fetchLogsPage).mockImplementation(async (_uid, filters) => (
      filters.brand === 'Shell'
        ? { logs: [log('s', 'Shell')], nextCursor: null, brands: ['Shell'] }
        : { logs: [log('a', 'Esso'), log('b', 'Shell')], nextCursor: null, brands: ['Shell', 'Esso'] }
    ));
    renderPage();

    const brandSelect = () => screen.getByLabelText('history.filters.brand') as HTMLSelectElement;
    const options = () => Array.from(brandSelect().options).map(o => o.value).filter(Boolean);
    await waitFor(() => expect(options()).toEqual(['Esso', 'Shell']));

    fireEvent.change(brandSelect(), { target: { value: 'Shell' } });
    const lastCall = () => vi.mocked(fetchLogsPage).mock.calls[vi.mocked(fetchLogsPage).mock.calls.length - 1];
    await waitFor(() => expect(lastCall()[1].brand).toBe('Shell'));
    // Narrowing to one brand must not drop the other option from the dropdown.
    expect(options()).toEqual(['Esso', 'Shell']);
  });

  it('exports every matching log, not just the loaded page', async () => {
    vi.mocked(fetchLogsPage).mockResolvedValue({ logs: [log('a')], nextCursor: cursor as never, brands: ['Esso'] });
    const all = Array.from({ length: 120 }, (_, i) => log(`l${i}`));
    vi.mocked(fetchAllLogs).mockResolvedValue({ logs: all as never, truncated: false });
    renderPage();

    fireEvent.click(await enabledExportButton());

    await waitFor(() => expect(exportLogsToPDF).toHaveBeenCalled());
    expect(fetchAllLogs).toHaveBeenCalledWith('u1', expect.any(Object));
    expect(vi.mocked(exportLogsToPDF).mock.calls[0][0]).toHaveLength(120);
  });

  it('skips the extra fetch when everything is already loaded', async () => {
    vi.mocked(fetchLogsPage).mockResolvedValue({ logs: [log('a'), log('b')], nextCursor: null, brands: ['Esso'] });
    renderPage();

    fireEvent.click(await enabledExportButton());

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

  describe('editing fill type', () => {
    const openAndSave = async (choose?: () => void) => {
      renderPage();
      fireEvent.click(await screen.findByTitle('history.table.editLog'));
      choose?.();
      fireEvent.click(screen.getByRole('button', { name: 'history.edit.save' }));
      await waitFor(() => expect(updateLog).toHaveBeenCalledTimes(1));
      return vi.mocked(updateLog).mock.calls[0][1];
    };

    it('does not stamp a legacy log with fillType when it is saved unchanged', async () => {
      vi.mocked(fetchLogsPage).mockResolvedValue({ logs: [log('a')], nextCursor: null, brands: ['Esso'] });
      const updates = await openAndSave();
      expect(updates).not.toHaveProperty('fillType');
      expect(updates).not.toHaveProperty('missedPrevious');
    });

    it('saves a partial fill and a missed previous fill-up', async () => {
      vi.mocked(fetchLogsPage).mockResolvedValue({ logs: [log('a')], nextCursor: null, brands: ['Esso'] });
      const updates = await openAndSave(() => {
        fireEvent.click(screen.getByRole('radio', { name: 'quickLog.fields.fillType_partial' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'quickLog.fields.missedPrevious' }));
      });
      expect(updates).toMatchObject({ fillType: 'partial', missedPrevious: true });
    });
  });
});
