// Example: src/components/ThemeToggle.tsx
import React from 'react';
import { useTheme } from '../context/ThemeContext'; // Adjust path
import { Sun, Moon } from 'lucide-react'; // Example icons

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme, isDarkModeEnabledRemotely } = useTheme();

  // Don't render the toggle if the feature is disabled via Remote Config
  if (!isDarkModeEnabledRemotely) {
    return null;
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};

export default ThemeToggle;