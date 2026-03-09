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

    const callArg = vi.mocked(initializeApp).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).toHaveProperty('measurementId');
  });

  it('resolves to an Analytics instance when isSupported returns true', async () => {
    mockIsSupported.mockResolvedValue(true);
    const { analytics } = await import('./config');

    const instance = await analytics;
    expect(instance).toEqual({ name: 'mock-analytics' });
    expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
  });

  it('resolves to null when isSupported returns false', async () => {
    mockIsSupported.mockResolvedValue(false);
    const { analytics } = await import('./config');

    const instance = await analytics;
    expect(instance).toBeNull();
    expect(mockGetAnalytics).not.toHaveBeenCalled();
  });
});
