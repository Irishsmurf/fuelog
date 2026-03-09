// src/components/Login.tsx
import { JSX, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import { useTranslation } from 'react-i18next';

// Define the component's return type
function Login(): JSX.Element {
  const { login } = useAuth();
  const { t } = useTranslation();

  // Add types for state variables
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Async function for handling login click
  const handleLoginClick = async (): Promise<void> => {
    setIsLoggingIn(true);
    setError(null); // Clear previous errors
    try {
      await login();
      // Login successful state change is handled by AuthProvider listener
    } catch (err) {
      console.error("Login component error:", err);
      setError(t('login.error'));
      setIsLoggingIn(false); // Set loading to false only if login fails
    }
  };

  return (
    // Full screen container, centers content using Flexbox (Tailwind)
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 dark:bg-brand-dark-surface relative">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <LanguageSelector />
        <ThemeToggle />
      </div>

      {/* Card container with Tailwind styling */}
      <div className="max-w-md w-full bg-white shadow-2xl rounded-3xl p-8 sm:p-12 border border-gray-100 space-y-8 dark:bg-gray-900 dark:border-gray-800 transition-all">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter text-brand-primary">
            fuel<span className="text-gray-300 dark:text-gray-600">og</span>
          </h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            {t('login.tagline')}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-300 text-sm leading-relaxed px-4">
            {t('login.description')}
          </p>

          <button
            onClick={handleLoginClick}
            disabled={isLoggingIn}
            className="w-full flex justify-center items-center py-4 px-6 rounded-2xl shadow-xl shadow-brand-primary/20 text-base font-black text-white bg-brand-primary hover:bg-brand-primary-hover focus:outline-none focus:ring-4 focus:ring-brand-primary/20 disabled:opacity-50 transition-all active:scale-95"
          >
            {/* Simple SVG for Google Logo */}
            <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isLoggingIn ? t('login.initializing') : t('login.getStarted')}
          </button>
        </div>

        {/* Error Message Area */}
        {error && (
          <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;
