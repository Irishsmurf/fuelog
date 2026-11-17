import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addVehicle, deleteVehicle, fetchVehicles, setDefaultVehicle, toggleArchiveVehicle } from '../data/vehicles';
import type { Vehicle } from '../utils/types';
import ProfilePage from './ProfilePage';
import { MemoryRouter } from 'react-router-dom';

const mockT = (key: string, opts?: Record<string, unknown>) => {
  if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

const mockUser = { uid: 'user-1' };
const mockUpdateProfile = vi.fn();
let mockProfile: { homeCurrency: string; monthlyBudget?: number } = { homeCurrency: 'EUR' };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, profile: mockProfile, updateProfile: mockUpdateProfile }),
}));

let mockFCMState = { isEnabled: false, isLoading: false, permissionDenied: false };
vi.mock('../hooks/useFCMToken', () => ({
  useFCMToken: () => ({ ...mockFCMState, enable: vi.fn(), disable: vi.fn() }),
}));

vi.mock('../components/ApiTokenManager', () => ({ default: () => <div /> }));
vi.mock('../components/LanguageSelector', () => ({ default: () => <div /> }));

vi.mock('../firebase/config', () => ({ db: {} }));

// The page reads and writes vehicles through the data layer.
vi.mock('../data/vehicles', () => ({
  fetchVehicles: vi.fn(),
  addVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
  setDefaultVehicle: vi.fn(),
  toggleArchiveVehicle: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><ProfilePage /></MemoryRouter></QueryClientProvider>);
}

const car = (over: Partial<Vehicle> = {}) =>
  ({ id: 'v1', name: 'Car', make: 'Toyota', model: 'Yaris', year: '2020', fuelType: 'Petrol', isDefault: true, isArchived: false, userId: 'user-1', ...over }) as Vehicle;

beforeEach(() => {
  vi.clearAllMocks();
  mockProfile = { homeCurrency: 'EUR' };
  mockFCMState = { isEnabled: false, isLoading: false, permissionDenied: false };
  vi.mocked(fetchVehicles).mockResolvedValue([]);
});

describe('ProfilePage vehicles', () => {
  it('lists vehicles including archived ones', async () => {
    vi.mocked(fetchVehicles).mockResolvedValue([car(), car({ id: 'v2', name: 'Old', isArchived: true, isDefault: false })]);
    renderPage();
    expect(await screen.findByText('Car')).toBeInTheDocument();
    expect(fetchVehicles).toHaveBeenCalledWith('user-1', { includeArchived: true });
  });

  it('adds a vehicle with the form values, clears the form and refetches the list', async () => {
    vi.mocked(addVehicle).mockResolvedValue();
    renderPage();
    await waitFor(() => expect(fetchVehicles).toHaveBeenCalledTimes(1));

    const name = screen.getByPlaceholderText('profile.vehicleForm.nicknamePlaceholder') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Van' } });
    fireEvent.change(screen.getByPlaceholderText('profile.vehicleForm.makePlaceholder'), { target: { value: 'Ford' } });
    fireEvent.change(screen.getByPlaceholderText('profile.vehicleForm.modelPlaceholder'), { target: { value: 'Transit' } });
    fireEvent.click(screen.getByRole('button', { name: 'profile.vehicleForm.register' }));

    await waitFor(() => expect(screen.getByText('profile.messages.vehicleAdded')).toBeInTheDocument());
    expect(vi.mocked(addVehicle).mock.calls[0][0]).toBe('user-1');
    expect(vi.mocked(addVehicle).mock.calls[0][1]).toMatchObject({ name: 'Van', make: 'Ford', model: 'Transit', fuelType: 'Petrol' });
    expect(name.value).toBe('');
    await waitFor(() => expect(fetchVehicles).toHaveBeenCalledTimes(2));
  });

  it('shows the permission error when adding is denied', async () => {
    vi.mocked(addVehicle).mockRejectedValue({ code: 'permission-denied' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('profile.vehicleForm.nicknamePlaceholder'), { target: { value: 'Van' } });
    fireEvent.change(screen.getByPlaceholderText('profile.vehicleForm.makePlaceholder'), { target: { value: 'Ford' } });
    fireEvent.change(screen.getByPlaceholderText('profile.vehicleForm.modelPlaceholder'), { target: { value: 'Transit' } });
    fireEvent.click(screen.getByRole('button', { name: 'profile.vehicleForm.register' }));
    await waitFor(() => expect(screen.getByText('profile.messages.permissionDenied')).toBeInTheDocument());
    // A failed save keeps what the user typed.
    expect((screen.getByPlaceholderText('profile.vehicleForm.nicknamePlaceholder') as HTMLInputElement).value).toBe('Van');
  });

  it('refuses to delete a vehicle that has logs and suggests archiving', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(fetchVehicles).mockResolvedValue([car()]);
    vi.mocked(deleteVehicle).mockResolvedValue({ deleted: false, logCount: 3 });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'profile.vehicleCard.delete' }));

    await waitFor(() => expect(screen.getByText(/This vehicle has 3 fuel logs|This vehicle has \{\{count\}\} fuel logs/)).toBeInTheDocument());
    expect(deleteVehicle).toHaveBeenCalledWith('user-1', 'v1');
    // Nothing was deleted, so the list is not refetched.
    expect(fetchVehicles).toHaveBeenCalledTimes(1);
  });

  it('refetches the list after a vehicle is deleted or archived', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(fetchVehicles).mockResolvedValue([car()]);
    vi.mocked(deleteVehicle).mockResolvedValue({ deleted: true });
    vi.mocked(toggleArchiveVehicle).mockResolvedValue();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'profile.vehicleCard.delete' }));
    await waitFor(() => expect(fetchVehicles).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'profile.vehicleCard.archive' }));
    await waitFor(() => expect(toggleArchiveVehicle).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' })));
    await waitFor(() => expect(fetchVehicles).toHaveBeenCalledTimes(3));
  });

  it('makes another vehicle the default', async () => {
    const vehicles = [car(), car({ id: 'v2', name: 'Bike', isDefault: false })];
    vi.mocked(fetchVehicles).mockResolvedValue(vehicles);
    vi.mocked(setDefaultVehicle).mockResolvedValue();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'profile.vehicleCard.makeDefault' }));
    await waitFor(() => expect(setDefaultVehicle).toHaveBeenCalledWith(expect.objectContaining({ id: 'v2' }), vehicles));
  });
});

describe('ProfilePage monthly budget field', () => {

  it('renders empty when no budget is set', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByPlaceholderText('profile.monthlyBudgetPlaceholder')).toBeInTheDocument());
    expect((screen.getByPlaceholderText('profile.monthlyBudgetPlaceholder') as HTMLInputElement).value).toBe('');
  });

  it('seeds the field from an existing budget', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    renderPage();
    await waitFor(() => expect((screen.getByPlaceholderText('profile.monthlyBudgetPlaceholder') as HTMLInputElement).value).toBe('150'));
  });

  it('saves a valid budget on blur', async () => {
    renderPage();
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');

    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);

    expect(mockUpdateProfile).toHaveBeenCalledWith({ monthlyBudget: 200 });
  });

  it('clears the budget (saves 0) when the field is emptied', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    renderPage();
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('150'));

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(mockUpdateProfile).toHaveBeenCalledWith({ monthlyBudget: 0 });
  });

  it('treats invalid/negative input as no budget', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    renderPage();
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('150'));

    fireEvent.change(input, { target: { value: '-50' } });
    fireEvent.blur(input);

    expect(mockUpdateProfile).toHaveBeenCalledWith({ monthlyBudget: 0 });
  });

  it('does not call updateProfile if the value is unchanged', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    renderPage();
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('150'));

    fireEvent.blur(input);

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('shows a browser-permission warning when notifications are denied', async () => {
    mockFCMState = { isEnabled: false, isLoading: false, permissionDenied: true };
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Notifications are blocked for this site/)).toBeInTheDocument();
    });
  });

  it('does not show the permission warning when notifications are not denied', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Weekly fuel digest')).toBeInTheDocument());
    expect(screen.queryByText(/Notifications are blocked for this site/)).not.toBeInTheDocument();
  });
});
