import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the useTheme hook
vi.mock('../context/ThemeContext', () => ({
  useTheme: vi.fn(),
}));

describe('ThemeToggle', () => {
  const mockToggleTheme = vi.fn();
  const mockSetThemeExplicitly = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render if dark mode is disabled remotely', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
      setThemeExplicitly: mockSetThemeExplicitly,
      isDarkModeEnabledRemotely: false,
    });

    const { container } = render(<ThemeToggle />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly in light mode', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
      setThemeExplicitly: mockSetThemeExplicitly,
      isDarkModeEnabledRemotely: true,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(button).toBeInTheDocument();
  });

  it('renders correctly in dark mode', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      toggleTheme: mockToggleTheme,
      setThemeExplicitly: mockSetThemeExplicitly,
      isDarkModeEnabledRemotely: true,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /switch to light mode/i });
    expect(button).toBeInTheDocument();
  });

  it('calls toggleTheme when clicked', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      toggleTheme: mockToggleTheme,
      setThemeExplicitly: mockSetThemeExplicitly,
      isDarkModeEnabledRemotely: true,
    });

    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });
});
