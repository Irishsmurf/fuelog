import React, { JSX, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import InstallPrompt from './InstallPrompt';
import BottomNav from './BottomNav';
import SyncStatus from './SyncStatus';
import ImportOnboardingPrompt from './ImportOnboardingPrompt';

// Wraps React.lazy with a single reload on chunk fetch failure.
// This handles the stale-PWA-cache scenario where a new deploy renames
// chunk files and an old service worker can no longer serve the old hash.
// Guarded by sessionStorage so a chunk that still 404s after the reload
// (e.g. CDN propagation lag, offline) falls through to the route's
// ErrorBoundary instead of reload-looping forever.
const CHUNK_RELOAD_KEY = 'fuelog-chunk-reload-attempted';

function lazyWithRetry<T extends React.ComponentType<React.ComponentProps<T>>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory()
      .then((module) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return module;
      })
      .catch((error) => {
        const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === 'true';
        if (!alreadyReloaded) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw error;
      })
  );
}

// Lazy load pages for performance
const QuickLogPage = lazyWithRetry(() => import('../pages/QuickLogPage'));
const HistoryPage = lazyWithRetry(() => import('../pages/HistoryPage'));
const ImportPage = lazyWithRetry(() => import('../pages/ImportPage'));
const ProfilePage = lazyWithRetry(() => import('../pages/ProfilePage'));
const PrivacyPolicyPage = lazyWithRetry(() => import('../pages/PrivacyPolicyPage'));
const AboutPage = lazyWithRetry(() => import('../pages/AboutPage'));
const FuelMapPage = lazyWithRetry(() => import('./FuelMapPage'));
const StationsPage = lazyWithRetry(() => import('../pages/StationsPage'));
const DashboardPage = lazyWithRetry(() => import('../pages/DashboardPage'));
const AdminConsolePage = lazyWithRetry(() => import('../pages/AdminConsolePage'));

// Pages with wide data tables need more horizontal room than the default
// max-w-5xl content column allows, or their tables overflow into a
// horizontal scrollbar even on wide monitors.
const WIDE_LAYOUT_PATHS = new Set(['/history', '/stations']);

// The map renders as a full-bleed, fixed full-viewport layer that sits
// *behind* the chrome (the translucent header and the footer/bottom-nav
// float over it). On this route the normal centered content column would
// just be an empty padded box, so drop the container constraints.
const FULL_BLEED_PATHS = new Set(['/map']);

/** Loading fallback for Suspense */
const PageLoader = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 dark:border-gray-700 border-t-brand-primary"></div>
      <p className="text-gray-500 dark:text-gray-400 animate-pulse tracking-widest uppercase text-xs">{t('common.loading')}</p>
    </div>
  );
};

function AuthenticatedApp(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  const currentPath = location.pathname.replace(/\/$/, '');
  const isFullBleed = FULL_BLEED_PATHS.has(currentPath);

  const getNavLinkClass = (path: string): string => {
    const baseClass = "px-2 py-1.5 text-sm font-medium rounded-md transition-colors duration-200";
    const activeClass = "text-brand-primary-hover dark:text-brand-primary";
    const inactiveClass = "text-gray-600 dark:text-gray-300 hover:text-brand-primary-hover dark:hover:text-brand-primary";
    return `${baseClass} ${location.pathname === path ? activeClass : inactiveClass}`;
  };

  return (<>
    <div className="min-h-screen flex flex-col pb-16 sm:pb-0 overflow-x-hidden">
      {/* Brand Glass Header */}
      <header className="glass-header">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <Link to="/" className="inline-flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
            <span className="w-6 h-6 rounded-md bg-amber-200 dark:bg-amber-800 inline-flex items-center justify-center flex-none">
              <svg width="13" height="13" viewBox="0 0 256 256" className="fill-amber-700 dark:fill-amber-200" aria-hidden="true">
                <path d="M128,24S64,112,64,157a64,64,0,0,0,128,0C192,112,128,24,128,24Z" />
              </svg>
            </span>
            <span className="font-display text-lg font-medium tracking-tight text-gray-900 dark:text-gray-100">fuelog</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center space-x-2">
            <Link to="/" className={getNavLinkClass("/")}>{t('nav.log')}</Link>
            <Link to="/dashboard" className={getNavLinkClass("/dashboard")}>{t('nav.dashboard')}</Link>
            <Link to="/history" className={getNavLinkClass("/history")}>{t('nav.history')}</Link>
            <Link to="/map" className={getNavLinkClass("/map")}>{t('nav.map')}</Link>
            <Link to="/stations" className={getNavLinkClass("/stations")}>{t('nav.stations')}</Link>
            <Link to="/profile" className={getNavLinkClass("/profile")}>{t('nav.profile')}</Link>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
            <LanguageSelector compact />
            <ThemeToggle />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden lg:inline">
              {user?.displayName?.split(' ')[0] || t('common.user')}
            </span>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90"
              title={t('common.signOut')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      <SyncStatus />

      <main className={`flex-grow w-full min-w-0 ${
        isFullBleed
          ? ''
          : `container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${
              WIDE_LAYOUT_PATHS.has(currentPath) ? 'max-w-7xl' : 'max-w-5xl'
            }`
      }`}>
        {!isFullBleed && <ImportOnboardingPrompt />}
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<QuickLogPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/map" element={<FuelMapPage />} />
            <Route path="/stations" element={<StationsPage />} />
            <Route path="/admin" element={<AdminConsolePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="hidden sm:block relative z-30 bg-transparent border-t border-gray-200 dark:border-gray-700/60 py-4 mb-0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
               {t('footer.copyright', { year: new Date().getFullYear() })} | {' '}
               <Link to="/about" className="hover:text-amber-600 dark:hover:text-amber-400 underline underline-offset-2">
                   {t('footer.about')}
               </Link> | {' '}
              <Link to="/privacy" className="hover:text-amber-600 dark:hover:text-amber-400 underline underline-offset-2">
                  {t('footer.privacyPolicy')}
              </Link>
          </div>
      </footer>

      {/* Mobile Only Navigation */}
      <BottomNav />
      
      <InstallPrompt />
    </div>
  </>);
}

export default AuthenticatedApp;