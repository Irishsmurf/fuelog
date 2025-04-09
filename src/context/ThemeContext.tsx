// src/context/ThemeContext.tsx
import { JSX, createContext, useState, useEffect, useContext, useMemo, ReactNode } from 'react';

// Define the possible theme values
type Theme = 'light' | 'dark';

// Define the shape of the context value
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// Create the context
const ThemeContext = createContext<ThemeContextType | null>(null);

// Define props for the provider component
interface ThemeProviderProps {
  children: ReactNode;
}

// Create a provider component
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  // State to hold the current theme
  // Initialize based on localStorage or system preference
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme) {
      return storedTheme;
    }
    // Check system preference if no theme stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Effect to apply the theme class to the <html> element and save to localStorage
  useEffect(() => {
    const root = window.document.documentElement; // Get the <html> element
    const previousTheme = theme === 'dark' ? 'light' : 'dark';

    root.classList.remove(previousTheme); // Remove the opposite theme class
    root.classList.add(theme); // Add the current theme class

    // Save the user's preference to localStorage
    localStorage.setItem('theme', theme);

    console.log(`Theme changed to: ${theme}`); // Log theme changes

  }, [theme]); // Run this effect whenever the theme state changes

  // Function to toggle the theme
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    theme,
    toggleTheme
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to easily consume the ThemeContext
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
