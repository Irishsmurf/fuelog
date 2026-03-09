import { render, screen, waitFor } from '@testing-library/react';
import { RemoteConfigProvider, useRemoteConfig } from './RemoteConfigContext';
import * as rcService from '../firebase/remoteConfigService';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Remote Config Service
vi.mock('../firebase/remoteConfigService', () => ({
  activateRemoteConfig: vi.fn(),
  getBoolean: vi.fn(),
  getString: vi.fn(),
  getNumber: vi.fn(),
}));

const TestComponent = () => {
  const { loading, getBoolean } = useRemoteConfig();
  if (loading) return <div data-testid="loading">Loading...</div>;
  return (
    <div data-testid="content">
      {getBoolean('testFlag') ? 'Enabled' : 'Disabled'}
    </div>
  );
};

describe('RemoteConfigContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides loading state and values after activation', async () => {
    vi.mocked(rcService.activateRemoteConfig).mockResolvedValue(true);
    vi.mocked(rcService.getBoolean).mockReturnValue(true);

    render(
      <RemoteConfigProvider>
        <TestComponent />
      </RemoteConfigProvider>
    );

    // Should show loading initially
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Wait for activation to finish
    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(rcService.activateRemoteConfig).toHaveBeenCalledTimes(1);
    expect(rcService.getBoolean).toHaveBeenCalledWith('testFlag');
  });

  it('handles activation failure gracefully', async () => {
    vi.mocked(rcService.activateRemoteConfig).mockRejectedValue(new Error('Fetch failed'));
    vi.mocked(rcService.getBoolean).mockReturnValue(false);

    render(
      <RemoteConfigProvider>
        <TestComponent />
      </RemoteConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('throws error if used outside of provider', () => {
    // Suppress console.error for this expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => render(<TestComponent />)).toThrow('useRemoteConfig must be used within a RemoteConfigProvider');
    
    consoleSpy.mockRestore();
  });
});
