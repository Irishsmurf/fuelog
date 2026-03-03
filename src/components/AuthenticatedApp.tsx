import { JSX, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import InstallPrompt from './InstallPrompt';
import BottomNav from './BottomNav';
import SyncStatus from './SyncStatus';

// Lazy load pages for performance
const QuickLogPage = lazy(() => import('../pages/QuickLogPage'));
const HistoryPage = lazy(() => import('../pages/HistoryPage'));
const ImportPage = lazy(() => import('../pages/ImportPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const FuelMapPage = lazy(() => import('./FuelMapPage'));

/** Loading fallback for Suspense */
const PageLoader = () => (
  <div className="flex flex-col justify-center items-center min-h-[60vh] space-y-4">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium animate-pulse">Loading...</p>
  </div>
);

function AuthenticatedApp(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getNavLinkClass = (path: string): string => {
    const baseClass = "px-3 py-1.5 text-sm font-bold rounded-xl transition-all duration-200";
    const activeClass = "bg-brand-primary text-white shadow-md shadow-brand-primary/20 scale-105";
    const inactiveClass = "text-gray-600 dark:text-gray-400 hover:text-brand-primary dark:hover:text-brand-primary hover:bg-gray-100 dark:hover:bg-gray-800";
    return `${baseClass} ${location.pathname === path ? activeClass : inactiveClass}`;
  };

  return (<>
    <div className="min-h-screen flex flex-col pb-16 sm:pb-0 overflow-x-hidden">
      {/* Brand Glass Header */}
      <header className="glass-header">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <Link to="/" className="text-2xl font-black tracking-tighter text-brand-primary hover:opacity-80 transition-opacity">
            fuel<span className="text-gray-400 dark:text-gray-500">og</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center space-x-2">
            <Link to="/" className={getNavLinkClass("/")}>Log</Link>
            <Link to="/history" className={getNavLinkClass("/history")}>History</Link>
            <Link to="/import" className={getNavLinkClass("/import")}>Import</Link>
            <Link to="/profile" className={getNavLinkClass("/profile")}>Profile</Link>
            <Link to="/map" className={getNavLinkClass("/map")}>Map</Link>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            <ThemeToggle />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden lg:inline">
              {user?.displayName?.split(' ')[0] || 'User'}
            </span>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-90"
              title="Sign Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      <SyncStatus />

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0 max-w-5xl">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<QuickLogPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/map" element={<FuelMapPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="hidden sm:block bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4 mb-0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
               © {new Date().getFullYear()} Fuelog | {' '}
               <Link to="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400 underline">
                   About
               </Link> | {' '}
              <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 underline">
                  Privacy Policy
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