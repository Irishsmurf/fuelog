// src/context/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useRemoteConfig } from './RemoteConfigContext';

type Theme = 'light' | 'dark';

interface ThemeContextProps {
  theme: Theme;
  isDarkModeEnabledRemotely: boolean; // From Remote Config
  toggleTheme: () => void;
  setThemeExplicitly: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { loading: rcLoading, getBoolean } = useRemoteConfig();
  
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) return savedTheme;
    
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only apply if user hasn't set a manual preference in localStorage.
      if (!localStorage.getItem('theme')) {
        // Update the theme state; the useEffect at line 90 will handle the DOM update.
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const [isDarkModeEnabledRemotely, setIsDarkModeEnabledRemotely] = useState<boolean>(false);

  // Function to apply theme changes (add/remove 'dark' class, save to localStorage)
  const setThemeState = (newTheme: Theme) => {
    const root = window.document.documentElement;
    const isDark = newTheme === 'dark';

    root.classList.remove(isDark ? 'light' : 'dark');
    root.classList.add(newTheme);

    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  // Toggle function, only works if enabled remotely
  const toggleTheme = () => {
    if (isDarkModeEnabledRemotely) {
      setThemeState(theme === 'light' ? 'dark' : 'light');
    } else {
      console.warn("Dark mode toggling disabled by Remote Config.");
      setThemeState('light'); // Ensure it stays light if disabled
    }
  };

  // Function to set theme directly (used by RC check)
  const setThemeExplicitly = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Sync with Remote Config once loaded
  useEffect(() => {
    if (!rcLoading) {
      const enabled = getBoolean('darkModeEnabled');
      queueMicrotask(() => {
        setIsDarkModeEnabledRemotely(enabled);
      });
      console.log("Remote Config - darkModeEnabled:", enabled);

      // If RC disables dark mode, force light mode
      if (!enabled) {
        queueMicrotask(() => setThemeState('light'));
      } else {
        // If RC enables it, respect localStorage or default
        const savedTheme = localStorage.getItem('theme') as Theme | null;
        queueMicrotask(() => setThemeState(savedTheme || 'light'));
      }
    }
  }, [rcLoading, getBoolean]);

  // Apply initial theme class on mount (after initial state is set)
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'light' ? 'dark' : 'light');
    root.classList.add(theme);
  }, [theme]); // Re-run if theme changes

  // Don't render children until RC check is complete to avoid theme flash
  if (rcLoading) {
      // Optional: Render a minimal loading state or null
      return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDarkModeEnabledRemotely, toggleTheme, setThemeExplicitly }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
