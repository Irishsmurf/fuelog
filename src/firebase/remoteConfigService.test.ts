import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchAndActivate = vi.fn();
const mockGetValue = vi.fn();
const mockGetRemoteConfig = vi.fn();

vi.mock('firebase/remote-config', () => ({
  getRemoteConfig: mockGetRemoteConfig,
  fetchAndActivate: mockFetchAndActivate,
  getValue: mockGetValue,
}));

vi.mock('./config', () => ({
  app: { name: 'mock-app' },
}));

// Helper to build a minimal RemoteConfig-like instance
const makeMockInstance = () => ({ defaultConfig: {}, settings: { minimumFetchIntervalMillis: 0 } });

describe('remoteConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('when Remote Config initializes successfully', () => {
    beforeEach(() => {
      mockGetRemoteConfig.mockReturnValue(makeMockInstance());
    });

    it('exports a non-null remoteConfigInstance', async () => {
      const { remoteConfigInstance } = await import('./remoteConfigService');
      expect(remoteConfigInstance).not.toBeNull();
    });

    it('activateRemoteConfig returns true when fresh values are fetched', async () => {
      mockFetchAndActivate.mockResolvedValue(true);
      const { activateRemoteConfig } = await import('./remoteConfigService');
      const result = await activateRemoteConfig();
      expect(result).toBe(true);
      expect(mockFetchAndActivate).toHaveBeenCalledTimes(1);
    });

    it('activateRemoteConfig returns false when using cached values', async () => {
      mockFetchAndActivate.mockResolvedValue(false);
      const { activateRemoteConfig } = await import('./remoteConfigService');
      const result = await activateRemoteConfig();
      expect(result).toBe(false);
    });

    it('activateRemoteConfig returns false when fetch throws', async () => {
      mockFetchAndActivate.mockRejectedValue(new Error('network error'));
      const { activateRemoteConfig } = await import('./remoteConfigService');
      const result = await activateRemoteConfig();
      expect(result).toBe(false);
    });

    it('getBoolean delegates to getValue().asBoolean()', async () => {
      const mockValue = { asBoolean: () => true, asString: () => 'true', asNumber: () => 1 };
      mockGetValue.mockReturnValue(mockValue);
      const { getBoolean } = await import('./remoteConfigService');
      expect(getBoolean('darkModeEnabled')).toBe(true);
      expect(mockGetValue).toHaveBeenCalledWith(expect.anything(), 'darkModeEnabled');
    });

    it('getString delegates to getValue().asString()', async () => {
      const mockValue = { asBoolean: () => false, asString: () => 'hello', asNumber: () => 0 };
      mockGetValue.mockReturnValue(mockValue);
      const { getString } = await import('./remoteConfigService');
      expect(getString('someKey')).toBe('hello');
    });

    it('getNumber delegates to getValue().asNumber()', async () => {
      const mockValue = { asBoolean: () => false, asString: () => '42', asNumber: () => 42 };
      mockGetValue.mockReturnValue(mockValue);
      const { getNumber } = await import('./remoteConfigService');
      expect(getNumber('someKey')).toBe(42);
    });
  });

  describe('when Remote Config fails to initialize (e.g. IndexedDB unavailable)', () => {
    beforeEach(() => {
      mockGetRemoteConfig.mockImplementation(() => {
        throw new Error('Internal error opening backing store for indexedDB.open.');
      });
    });

    it('exports a null remoteConfigInstance instead of throwing', async () => {
      const { remoteConfigInstance } = await import('./remoteConfigService');
      expect(remoteConfigInstance).toBeNull();
    });

    it('activateRemoteConfig returns false without calling fetchAndActivate', async () => {
      const { activateRemoteConfig } = await import('./remoteConfigService');
      const result = await activateRemoteConfig();
      expect(result).toBe(false);
      expect(mockFetchAndActivate).not.toHaveBeenCalled();
    });

    it('getBoolean falls back to default config value', async () => {
      const { getBoolean } = await import('./remoteConfigService');
      expect(getBoolean('darkModeEnabled')).toBe(true);
      expect(getBoolean('receiptDigitizationEnabled')).toBe(false);
      expect(mockGetValue).not.toHaveBeenCalled();
    });

    it('getString falls back to default config value as string', async () => {
      const { getString } = await import('./remoteConfigService');
      expect(getString('darkModeEnabled')).toBe('true');
    });

    it('getNumber falls back to default config value as number', async () => {
      const { getNumber } = await import('./remoteConfigService');
      expect(getNumber('darkModeEnabled')).toBe(1);
    });

    it('getString returns empty string for unknown key', async () => {
      const { getString } = await import('./remoteConfigService');
      expect(getString('unknownKey')).toBe('');
    });

    it('getBoolean returns false for unknown key', async () => {
      const { getBoolean } = await import('./remoteConfigService');
      expect(getBoolean('unknownKey')).toBe(false);
    });

    it('getNumber returns NaN for unknown key', async () => {
      const { getNumber } = await import('./remoteConfigService');
      expect(getNumber('unknownKey')).toBeNaN();
    });

    it('getRemoteConfigValue throws for unknown key', async () => {
      const { getRemoteConfigValue } = await import('./remoteConfigService');
      expect(() => getRemoteConfigValue('someKey')).toThrow();
    });
  });
});
