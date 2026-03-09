import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/app before importing config
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn().mockReturnValue({ name: 'mock-app' }),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn().mockReturnValue({}),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn().mockReturnValue({}),
  persistentLocalCache: vi.fn().mockReturnValue({}),
  persistentSingleTabManager: vi.fn().mockReturnValue({}),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn().mockReturnValue({}),
}));

const mockGetAnalytics = vi.fn().mockReturnValue({ name: 'mock-analytics' });
const mockIsSupported = vi.fn();

vi.mock('firebase/analytics', () => ({
  getAnalytics: mockGetAnalytics,
  isSupported: mockIsSupported,
}));

describe('firebase/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('passes measurementId to initializeApp', async () => {
    mockIsSupported.mockResolvedValue(false);
    const { initializeApp } = await import('firebase/app');
    await import('./config');

    expect(initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ measurementId: expect.any(String) })
    );
  });

  it('calls getAnalytics when isSupported returns true', async () => {
    mockIsSupported.mockResolvedValue(true);
    await import('./config');

    // isSupported() is async — wait for the microtask to settle
    await Promise.resolve();

    expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
  });

  it('does not call getAnalytics when isSupported returns false', async () => {
    mockIsSupported.mockResolvedValue(false);
    await import('./config');

    await Promise.resolve();

    expect(mockGetAnalytics).not.toHaveBeenCalled();
  });
});
