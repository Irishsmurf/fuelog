import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onAuthStateChanged, User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { AuthProvider, useAuth } from './AuthContext';
import { signInWithGoogle as mockSignInWithGoogle, logout as mockLogout } from '../firebase/config';

vi.mock('firebase/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/auth')>();
    return {
        ...actual,
        onAuthStateChanged: vi.fn(),
    };
});

vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        doc: vi.fn(),
        setDoc: vi.fn(),
        onSnapshot: vi.fn(),
    };
});

vi.mock('firebase/analytics', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/analytics')>();
    return {
        ...actual,
        setUserProperties: vi.fn(),
    };
});

vi.mock('../firebase/config', () => ({
    auth: {},
    db: {},
    analytics: Promise.resolve(null),
    signInWithGoogle: vi.fn(),
    logout: vi.fn(),
}));

const TestComponent = () => {
    const { loading, user, profile, login, logout } = useAuth();
    if (loading) return <div data-testid="loading">Loading...</div>;
    return (
        <div data-testid="content">
            <span data-testid="user">{user ? user.uid : 'none'}</span>
            <span data-testid="profile">{profile ? profile.homeCurrency : 'none'}</span>
            <button onClick={() => login()}>Sign in</button>
            <button onClick={() => logout()}>Sign out</button>
        </div>
    );
};

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sets loading false and exposes the user once signed in with a profile', async () => {
        const mockUser = { uid: 'user-1' } as User;

        vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
            (callback as (user: User | null) => void)(mockUser);
            return vi.fn();
        });

        vi.mocked(onSnapshot).mockImplementation((_ref, onNext) => {
            (onNext as (snap: { exists: () => boolean; data: () => unknown }) => void)({
                exists: () => true,
                data: () => ({ homeCurrency: 'USD', tester_group: false }),
            });
            return vi.fn();
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('content')).toBeInTheDocument();
        });

        expect(screen.getByTestId('user').textContent).toBe('user-1');
        expect(screen.getByTestId('profile').textContent).toBe('USD');
    });

    it('clears the user and profile, and stops loading, when signed out', async () => {
        vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
            (callback as (user: User | null) => void)(null);
            return vi.fn();
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('content')).toBeInTheDocument();
        });

        expect(screen.getByTestId('user').textContent).toBe('none');
        expect(screen.getByTestId('profile').textContent).toBe('none');
    });

    it('clears loading even if the profile snapshot errors out', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
            (callback as (user: User | null) => void)({ uid: 'user-1' } as User);
            return vi.fn();
        });

        vi.mocked(onSnapshot).mockImplementation((_ref, _onNext, onError) => {
            (onError as unknown as (error: { code: string; message: string }) => void)({
                code: 'permission-denied',
                message: 'Missing permissions',
            });
            return vi.fn();
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('content')).toBeInTheDocument();
        });

        expect(screen.getByTestId('profile').textContent).toBe('none');
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('login() calls signInWithGoogle', async () => {
        vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
            (callback as (user: User | null) => void)(null);
            return vi.fn();
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('content')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Sign in'));

        expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('logout() calls logout from config', async () => {
        vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
            (callback as (user: User | null) => void)({ uid: 'user-1' } as User);
            return vi.fn();
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('content')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Sign out'));

        expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    it('throws when useAuth is used outside of an AuthProvider', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<TestComponent />)).toThrow('useAuth must be used within an AuthProvider');
        consoleSpy.mockRestore();
    });
});
