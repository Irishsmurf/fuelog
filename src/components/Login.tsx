// src/components/Login.tsx
import { JSX, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import { useTranslation } from 'react-i18next';

function Login(): JSX.Element {
  const { login } = useAuth();
  const { t } = useTranslation();

  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginClick = async (): Promise<void> => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await login();
    } catch (err) {
      console.error("Login component error:", err);
      setError(t('login.error'));
      setIsLoggingIn(false);
    }
  };

  return (
    // Always dark — the forecourt at night
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0F1E] px-6 relative overflow-hidden">
      {/* Ambient light: a faint amber radial bloom behind the wordmark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(217,119,6,0.07) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
        <LanguageSelector />
        <ThemeToggle />
      </div>

      <div className="relative max-w-xs w-full space-y-10">
        {/* Wordmark block */}
        <div className="space-y-4">
          <h1
            className="text-[5.5rem] leading-none font-bold tracking-tighter font-display"
            style={{ letterSpacing: '-0.04em' }}
          >
            <span className="text-amber-500">fuel</span>
            <span className="text-gray-700">og</span>
          </h1>

          {/* Amber rule — the length of the wordmark, extending brand presence */}
          <div className="h-px bg-gradient-to-r from-amber-500/60 via-amber-400/30 to-transparent" />

          <p className="font-mono text-[10px] text-gray-500 uppercase tracking-[0.22em]">
            {t('login.tagline')}
          </p>
        </div>

        {/* Sign-in block */}
        <div className="space-y-5">
          <p className="text-gray-400 text-sm leading-relaxed">
            {t('login.description')}
          </p>

          <button
            onClick={handleLoginClick}
            disabled={isLoggingIn}
            className="w-full flex justify-center items-center gap-3 py-4 px-6 rounded-xl text-sm font-bold text-gray-950 bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#0A0F1E] disabled:opacity-40 transition-all duration-150 active:scale-[0.98]"
          >
            {/* Google G mark */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#1a1a1a" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#1a1a1a" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#1a1a1a" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#1a1a1a" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isLoggingIn ? t('login.initializing') : t('login.getStarted')}
          </button>

          {error && (
            <p className="text-center text-xs text-red-400 font-mono">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
