import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import AuthenticatedApp from './AuthenticatedApp';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { displayName: 'Test User', uid: 'u1' }, logout: vi.fn() }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
    setThemeExplicitly: vi.fn(),
    isDarkModeEnabledRemotely: true,
  }),
}));

describe('AuthenticatedApp header', () => {
  it('renders the language switcher persistently in the header, not just on the Profile page (#139)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthenticatedApp />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('language.label')).toBeInTheDocument();
  });
});
