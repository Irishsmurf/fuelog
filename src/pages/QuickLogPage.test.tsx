import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, getDocs } from 'firebase/firestore';
import { fetchExchangeRate } from '../utils/currencyApi';
import { getLastOdometerReading } from '../firebase/firestoreService';
import { extractDataFromReceipt } from '../utils/gemini';
import QuickLogPage from './QuickLogPage';

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
  isAccurateEnoughForStationMatch: () => true,
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDocs).mockImplementation(async () => {
      return mockSnapshot([{ id: mockVehicle.id, data: mockVehicle }]) as never;
    });
    vi.mocked(getLastOdometerReading).mockResolvedValue(null);

    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: vi.fn((_success, error) => error?.({ code: 1, message: 'denied' })) },
      configurable: true,
    });
  });

  it('saves a fuel log with the correct payload on the happy path', async () => {
    render(<QuickLogPage />);

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
    render(<QuickLogPage />);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.totalCost')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /quickLog.submit.save/ }));

    await waitFor(() => expect(screen.getByText('quickLog.messages.fillRequired')).toBeInTheDocument());
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('auto-populates distance from the odometer reading when a prior reading exists', async () => {
    vi.mocked(getLastOdometerReading).mockResolvedValue(10000);

    render(<QuickLogPage />);

    await waitFor(() => expect(screen.getByLabelText('quickLog.fields.odometer')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('quickLog.fields.odometer'), { target: { value: '10400' } });

    await waitFor(() => {
      expect((screen.getByLabelText('quickLog.fields.distance') as HTMLInputElement).value).toBe('400.0');
    });
  });

  it('fetches the exchange rate and stores originalCost + exchangeRate when a non-home currency is selected', async () => {
    vi.mocked(fetchExchangeRate).mockResolvedValue(1.1);

    render(<QuickLogPage />);

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
    vi.mocked(extractDataFromReceipt).mockResolvedValue({ cost: 42.5, fuelAmountLiters: 28, brand: 'Esso' });

    render(<QuickLogPage />);

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
});
