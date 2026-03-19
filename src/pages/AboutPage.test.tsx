import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AboutPage from './AboutPage';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import * as RemoteConfigContext from '../context/RemoteConfigContext';

// Mock dependencies
vi.mock('../context/RemoteConfigContext', () => ({
  useRemoteConfig: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

describe('AboutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(RemoteConfigContext.useRemoteConfig).mockReturnValue({
      getBoolean: vi.fn().mockReturnValue(false),
      getString: vi.fn().mockReturnValue(''),
      getNumber: vi.fn().mockReturnValue(0),
      loading: false,
    });
  });

  it('renders without crashing and does not throw React.Children related errors', () => {
    // This test ensures that the combination of React 19, react-helmet-async, 
    // and our component tree doesn't produce runtime errors like 
    // "Cannot set properties of undefined (setting 'Children')"
    render(
      <HelmetProvider>
        <BrowserRouter>
          <AboutPage />
        </BrowserRouter>
      </HelmetProvider>
    );

    expect(screen.getByText('about.title')).toBeTruthy();
    expect(screen.getByText('about.description')).toBeTruthy();
    expect(screen.getByText('about.featuresTitle')).toBeTruthy();
  });

  it('renders the new feature showcase when flag is enabled', () => {
    vi.mocked(RemoteConfigContext.useRemoteConfig).mockReturnValue({
      getBoolean: vi.fn().mockImplementation((key: string) => key === 'exampleFeatureFlagEnabled'),
      getString: vi.fn().mockReturnValue(''),
      getNumber: vi.fn().mockReturnValue(0),
      loading: false,
    });

    render(
      <HelmetProvider>
        <BrowserRouter>
          <AboutPage />
        </BrowserRouter>
      </HelmetProvider>
    );

    expect(screen.getByText(/New Feature Showcase/i)).toBeTruthy();
  });
});
