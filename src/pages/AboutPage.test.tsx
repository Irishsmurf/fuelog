import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AboutPage from './AboutPage';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('AboutPage', () => {
  it('renders without crashing and does not throw React.Children related errors', () => {
    // Guards the React 19 + react-helmet-async combination against runtime
    // errors like "Cannot set properties of undefined (setting 'Children')".
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
});
