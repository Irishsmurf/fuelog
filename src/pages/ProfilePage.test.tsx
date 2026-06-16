import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocs } from 'firebase/firestore';
import ProfilePage from './ProfilePage';

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
vi.mock('../utils/migrationService', () => ({ migrateUserLogsToStations: vi.fn() }));

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

vi.mock('../firebase/config', () => ({ db: {} }));

function mockSnapshot(docs: { id: string; data: Record<string, unknown> }[]) {
  return {
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      docs.forEach(d => cb({ id: d.id, data: () => d.data }));
    },
  };
}

describe('ProfilePage monthly budget field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfile = { homeCurrency: 'EUR' };
    mockFCMState = { isEnabled: false, isLoading: false, permissionDenied: false };
    vi.mocked(getDocs).mockResolvedValue(mockSnapshot([]) as never);
  });

  it('renders empty when no budget is set', async () => {
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByPlaceholderText('profile.monthlyBudgetPlaceholder')).toBeInTheDocument());
    expect((screen.getByPlaceholderText('profile.monthlyBudgetPlaceholder') as HTMLInputElement).value).toBe('');
  });

  it('seeds the field from an existing budget', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    render(<ProfilePage />);
    await waitFor(() => expect((screen.getByPlaceholderText('profile.monthlyBudgetPlaceholder') as HTMLInputElement).value).toBe('150'));
  });

  it('saves a valid budget on blur', async () => {
    render(<ProfilePage />);
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');

    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);

    expect(mockUpdateProfile).toHaveBeenCalledWith({ monthlyBudget: 200 });
  });

  it('clears the budget (saves 0) when the field is emptied', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    render(<ProfilePage />);
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('150'));

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(mockUpdateProfile).toHaveBeenCalledWith({ monthlyBudget: 0 });
  });

  it('treats invalid/negative input as no budget', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    render(<ProfilePage />);
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('150'));

    fireEvent.change(input, { target: { value: '-50' } });
    fireEvent.blur(input);

    expect(mockUpdateProfile).toHaveBeenCalledWith({ monthlyBudget: 0 });
  });

  it('does not call updateProfile if the value is unchanged', async () => {
    mockProfile = { homeCurrency: 'EUR', monthlyBudget: 150 };
    render(<ProfilePage />);
    const input = await screen.findByPlaceholderText('profile.monthlyBudgetPlaceholder');
    await waitFor(() => expect((input as HTMLInputElement).value).toBe('150'));

    fireEvent.blur(input);

    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('shows a browser-permission warning when notifications are denied', async () => {
    mockFCMState = { isEnabled: false, isLoading: false, permissionDenied: true };
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText(/Notifications are blocked for this site/)).toBeInTheDocument();
    });
  });

  it('does not show the permission warning when notifications are not denied', async () => {
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText('Weekly fuel digest')).toBeInTheDocument());
    expect(screen.queryByText(/Notifications are blocked for this site/)).not.toBeInTheDocument();
  });
});
