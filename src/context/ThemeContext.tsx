// src/context/ThemeContext.tsx
import { JSX, createContext, useState, useEffect, useContext, useMemo, ReactNode, useCallback } from 'react';

// Define the possible theme values
type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = "theme";
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
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme
      } else {
          // Check system preference if no theme stored
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

    } catch (error) {
      console.error("Error accessing localStorage:", error);
      return 'light';

    }
  });

  // Apply theme to root element and persist in localStorage
  useEffect(() => {
    try {
      const root = document.documentElement;
      
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }


      
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      console.log('Theme changed', theme);


    } catch (error) {
      console.error("Error applying theme or accessing localStorage:", error);
    }



  }, [theme]); // Run this effect whenever the theme state changes

  // Function to toggle the theme
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };
  
  const memoizedToggleTheme = useCallback(toggleTheme, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    theme, toggleTheme: memoizedToggleTheme
  }), [theme, memoizedToggleTheme]);

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
