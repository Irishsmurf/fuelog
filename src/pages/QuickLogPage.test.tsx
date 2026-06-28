import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, getDocs } from 'firebase/firestore';
import { fetchExchangeRate } from '../utils/currencyApi';
import { getLastOdometerReading, getOrCreateStation, updateStationMetrics } from '../firebase/firestoreService';
import { extractDataFromReceipt } from '../utils/gemini';
import { findNearestStation, geocodeAddress, isAccurateEnoughForStationMatch } from '../utils/locationService';
import QuickLogPage from './QuickLogPage';
import { MemoryRouter } from 'react-router-dom';

// Stub the Leaflet-based picker so these tests don't mount a real map; the
// picker has its own unit tests. Exposes a button that reports a fixed pin.
vi.mock('../components/LocationPicker', () => ({
  default: ({ onChange }: { onChange: (c: { latitude: number; longitude: number }) => void }) => (
    <button type="button" data-testid="pick-location" onClick={() => onChange({ latitude: 1.5, longitude: 2.5 })}>
      pick
    </button>
  ),
}));

const mockT = (key: string, opts?: Record<string, unknown>) => {
  const template = opts && 'defaultValue' in opts ? (opts.defaultValue as string) : key;
  if (!opts) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(opts[name] ?? ''));
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

const mockUser = { uid: 'user-1' };
const mockProfile = { homeCurrency: 'EUR' };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, profile: mockProfile }),
}));

const mockGetBoolean = (key: string) =>
  key === 'odometerInputEnabled' || key === 'receiptDigitizationEnabled' || key === 'receiptAutoFillEnabled';

vi.mock('../context/RemoteConfigContext', () => ({
  useRemoteConfig: () => ({ getBoolean: mockGetBoolean }),
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
  };
});

vi.mock('../firebase/config', () => ({
  db: {},
  analytics: Promise.resolve(null),
}));

vi.mock('../utils/currencyApi', () => ({
  fetchExchangeRate: vi.fn(),
  COMMON_CURRENCIES: [
    { code: 'EUR', symbol: '€' },
    { code: 'USD', symbol: '$' },
    { code: 'GBP', symbol: '£' },
  ],
}));

vi.mock('../firebase/storageService', () => ({
  uploadReceipt: vi.fn().mockResolvedValue(''),
}));

vi.mock('../firebase/firestoreService', () => ({
  getLastOdometerReading: vi.fn().mockResolvedValue(null),
  getOrCreateStation: vi.fn(),
  updateStationMetrics: vi.fn(),
}));

vi.mock('../utils/gemini', () => ({
  extractDataFromReceipt: vi.fn(),
}));

vi.mock('../utils/locationService', () => ({
  findNearestStation: vi.fn().mockResolvedValue(null),
  geocodeAddress: vi.fn().mockResolvedValue(null),
  getCurrentPosition: vi.fn().mockResolvedValue(null),
  isAccurateEnoughForStationMatch: vi.fn(() => true),
  GPS_ACCURACY_THRESHOLD_METERS: 100,
}));

const mockVehicle = { id: 'vehicle-1', name: 'Car', make: 'Toyota', isDefault: true, isArchived: false };

function mockSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return {
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      docs.forEach(d => cb({ id: d.id, data: () => d.data }));
    },
  };
}

describe('QuickLogPage', () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDocs).mockImplementation(async () => {
      return mockSnapshot([{ id: mockVehicle.id, data: mockVehicle }]) as never;
    });
    vi.mocked(getLastOdometerReading).mockResolvedValue(null);

    mockGetCurrentPosition = vi.fn((_success, error) => error?.({ code: 1, message: 'denied' }));
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
    });
  });

  it('saves a fuel log with the correct payload on the happy path', async () => {
    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/quickLog\.fields\.fillingStation/), { target: { value: 'Shell' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(addDoc).mock.calls[0];
    expect(payload).toMatchObject({
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      brand: 'Shell',
      cost: 50,
      distanceKm: 400,
      fuelAmountLiters: 30,
      currency: 'EUR',
      originalCost: 50,
      exchangeRate: 1,
    });
  });

  it('shows a validation error when required fields are missing', async () => {
    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(screen.getByText('quickLog.messages.fillRequired')).toBeInTheDocument());
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('auto-populates distance from the odometer reading when a prior reading exists', async () => {
    vi.mocked(getLastOdometerReading).mockResolvedValue(10000);

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.odometer')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('quickLog.fields.odometer'), { target: { value: '10400' } });

    await waitFor(() => {
      expect((screen.getByLabelText('quickLog.fields.distance') as HTMLInputElement).value).toBe('400.0');
    });
  });

  it('fetches the exchange rate and stores originalCost + exchangeRate when a non-home currency is selected', async () => {
    vi.mocked(fetchExchangeRate).mockResolvedValue(1.1);

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.currency')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('quickLog.fields.currency'), { target: { value: 'USD' } });

    await waitFor(() => expect(fetchExchangeRate).toHaveBeenCalledWith(expect.any(Date), 'USD', 'EUR'));
    await waitFor(() => expect((screen.getByLabelText(/quickLog.fields.exchangeRate/) as HTMLInputElement).value).toBe('1.1'));

    fireEvent.change(screen.getByLabelText(/quickLog\.fields\.fillingStation/), { target: { value: 'Shell' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(addDoc).mock.calls[0];
    expect(payload).toMatchObject({
      currency: 'USD',
      originalCost: 50,
      exchangeRate: 1.1,
    });
    expect((payload as { cost: number }).cost).toBeCloseTo(55);
  });

  it('extracts and pre-fills form fields from a receipt image', async () => {
    vi.mocked(extractDataFromReceipt).mockResolvedValue({ cost: 42.5, fuelAmountLiters: 28, brand: 'Esso', purchaseDate: null, purchaseTime: null, address: null });

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    const file = new File(['mock'], 'receipt.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await fireEvent.change(fileInput, { target: { files: [file] } });

    const extractButton = await screen.findByRole('button', { name: 'receipt.autoFillWithAI' });
    fireEvent.click(extractButton);

    await waitFor(() => expect(extractDataFromReceipt).toHaveBeenCalledWith(file));

    const useValuesButton = await screen.findByRole('button', { name: 'receipt.useValues' });
    fireEvent.click(useValuesButton);

    expect((screen.getByLabelText('quickLog.fields.totalCost') as HTMLInputElement).value).toBe('42.5');
    expect((screen.getByLabelText('quickLog.fields.fuel') as HTMLInputElement).value).toBe('28');
    expect((screen.getByLabelText(/quickLog\.fields\.fillingStation/) as HTMLInputElement).value).toBe('Esso');
  });

  it('pre-fills the date/time field from the receipt', async () => {
    vi.mocked(extractDataFromReceipt).mockResolvedValue({
      cost: null, fuelAmountLiters: null, brand: null,
      purchaseDate: '2026-06-20', purchaseTime: '14:30', address: null,
    });

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    const file = new File(['mock'], 'receipt.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'receipt.autoFillWithAI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'receipt.useValues' }));

    expect((screen.getByLabelText('Date & time of fuelling') as HTMLInputElement).value).toBe('2026-06-20T14:30');
  });

  it('geocodes the receipt address to default the map pin', async () => {
    vi.mocked(extractDataFromReceipt).mockResolvedValue({
      cost: 10, fuelAmountLiters: 5, brand: 'Esso',
      purchaseDate: null, purchaseTime: null, address: '1 Main St, Dublin',
    });
    vi.mocked(geocodeAddress).mockResolvedValue({ latitude: 10, longitude: 20 });
    vi.mocked(findNearestStation).mockResolvedValue(null);

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    const file = new File(['mock'], 'receipt.jpg', { type: 'image/jpeg' });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'receipt.autoFillWithAI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'receipt.useValues' }));

    await waitFor(() => expect(geocodeAddress).toHaveBeenCalledWith('1 Main St, Dublin'));
    // The pin becomes a manual location once geocoded.
    await waitFor(() => expect(screen.getByText('Pinned')).toBeInTheDocument());
  });

  it('saves a manually pinned location (no accuracy) and links its station', async () => {
    const mockStation = {
      id: 'station-9', osmId: 'node/9', name: 'Pinned Station', brand: 'Shell',
      latitude: 1.5, longitude: 2.5,
    };
    vi.mocked(findNearestStation).mockResolvedValue(mockStation);
    vi.mocked(getOrCreateStation).mockResolvedValue('station-9');

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    // Open the map and drop a pin via the stubbed picker.
    fireEvent.click(screen.getByRole('button', { name: 'Adjust on map' }));
    fireEvent.click(screen.getByTestId('pick-location'));
    await waitFor(() => expect(findNearestStation).toHaveBeenCalledWith(1.5, 2.5));

    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(addDoc).mock.calls[0];
    expect(payload).toMatchObject({ latitude: 1.5, longitude: 2.5, stationId: 'station-9' });
    // Manual pins carry no GPS accuracy figure.
    expect(payload).not.toHaveProperty('locationAccuracy');
  });

  describe('low GPS accuracy warning', () => {
    const setGeolocationAccuracy = (accuracy: number) => {
      mockGetCurrentPosition.mockImplementation((success) => {
        success({ coords: { latitude: 53.3, longitude: -6.2, accuracy } });
      });
    };

    it('shows a persistent warning banner that survives the save flow when accuracy is poor', async () => {
      vi.mocked(isAccurateEnoughForStationMatch).mockReturnValue(false);
      setGeolocationAccuracy(500);

      render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

      await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

      fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

      // The warning appears during station-detection...
      await waitFor(() =>
        expect(screen.getByText('GPS accuracy is low (500m); skipping station detection.')).toBeInTheDocument()
      );

      // ...and is still visible once the save completes successfully (not overwritten
      // by the subsequent "saving"/"success" status messages, which share a different slot).
      await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
      expect(screen.getByText('GPS accuracy is low (500m); skipping station detection.')).toBeInTheDocument();
    });

    it('does not show the warning banner when accuracy is within the threshold', async () => {
      vi.mocked(isAccurateEnoughForStationMatch).mockReturnValue(true);
      setGeolocationAccuracy(20);

      render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

      await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

      fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

      await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/skipping station detection/)).not.toBeInTheDocument();
    });

    it('clears a previous warning when a new submission has good accuracy', async () => {
      vi.mocked(isAccurateEnoughForStationMatch).mockReturnValue(false);
      setGeolocationAccuracy(500);

      render(<MemoryRouter><QuickLogPage /></MemoryRouter>);
      await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });
      fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

      await waitFor(() =>
        expect(screen.getByText('GPS accuracy is low (500m); skipping station detection.')).toBeInTheDocument()
      );
      await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

      // Second submission with good accuracy should clear the stale warning.
      vi.mocked(isAccurateEnoughForStationMatch).mockReturnValue(true);
      setGeolocationAccuracy(20);

      fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '60' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '300' } });
      fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '20' } });
      fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

      await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(2));
      expect(screen.queryByText(/skipping station detection/)).not.toBeInTheDocument();
    });
  });

  it('successfully captures location, matches nearest station, and updates station metrics', async () => {
    const mockStation = {
      id: 'station-123',
      osmId: 'node/123',
      name: 'Shell Berlin',
      brand: 'Shell',
      latitude: 52.52,
      longitude: 13.405,
    };

    vi.mocked(findNearestStation).mockResolvedValue(mockStation);
    vi.mocked(getOrCreateStation).mockResolvedValue('station-123');

    mockGetCurrentPosition.mockImplementation((success) =>
      success({
        coords: {
          latitude: 52.52,
          longitude: 13.405,
          accuracy: 15,
        },
      })
    );

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(addDoc).mock.calls[0];
    expect(payload).toMatchObject({
      brand: 'Shell Berlin',
      latitude: 52.52,
      longitude: 13.405,
      locationAccuracy: 15,
      stationId: 'station-123',
    });

    expect(updateStationMetrics).toHaveBeenCalledWith('station-123', 50 / 30);
  });

  it('omits stationId from the payload when no station is linked (no undefined fields)', async () => {
    // Geolocation is denied in the default beforeEach, so no station is linked.
    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/quickLog\.fields\.fillingStation/), { target: { value: 'Shell' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(addDoc).mock.calls[0];
    // Firestore's addDoc() rejects fields whose value is undefined, so optional
    // fields must be absent rather than set to undefined.
    expect(payload).not.toHaveProperty('stationId');
    expect(payload).not.toHaveProperty('receiptUrl');
    expect(Object.values(payload as Record<string, unknown>)).not.toContain(undefined);
  });

  it('still saves the log and warns the user when updating station metrics fails', async () => {
    const mockStation = {
      id: 'station-123',
      osmId: 'node/123',
      name: 'Shell Berlin',
      brand: 'Shell',
      latitude: 52.52,
      longitude: 13.405,
    };

    vi.mocked(findNearestStation).mockResolvedValue(mockStation);
    vi.mocked(getOrCreateStation).mockResolvedValue('station-123');
    vi.mocked(updateStationMetrics).mockRejectedValue(new Error('permission-denied'));

    mockGetCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: 52.52, longitude: 13.405, accuracy: 15 } })
    );

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    // The log itself is still persisted...
    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    // ...and the user is warned about the metrics update without checking the console.
    await waitFor(() =>
      expect(screen.getByText(/quickLog\.messages\.stationMetricsWarning/)).toBeInTheDocument()
    );
  });

  it('shows a clear error with the failure detail when the Firestore write fails', async () => {
    vi.mocked(addDoc).mockRejectedValue(new Error('permission-denied'));

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    // The save error is surfaced to the user instead of only being logged.
    // (The mock t() returns the key; the real en.json string interpolates the
    // {{detail}} placeholder with the underlying error message.)
    await waitFor(() =>
      expect(screen.getByText(/quickLog\.messages\.saveError/)).toBeInTheDocument()
    );
  });

  it('still saves the log and warns the user when station lookup fails', async () => {
    vi.mocked(findNearestStation).mockRejectedValue(new Error('network'));

    mockGetCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: 52.52, longitude: 13.405, accuracy: 15 } })
    );

    render(<MemoryRouter><QuickLogPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('quickLog.fields.totalCost'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.distance'), { target: { value: '400' } });
    fireEvent.change(screen.getByLabelText('quickLog.fields.fuel'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(/quickLog\.messages\.stationLookupWarning/)).toBeInTheDocument()
    );

    const [, payload] = vi.mocked(addDoc).mock.calls[0];
    expect(payload).not.toHaveProperty('stationId');
  });
});
