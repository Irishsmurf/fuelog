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
    const baseClass = "px-2 py-1 text-sm font-medium rounded-md transition duration-150 ease-in-out";
    // Update active/inactive classes for dark mode
    const activeClass = "bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-100";
    const inactiveClass = "text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-700";
    return `${baseClass} ${location.pathname === path ? activeClass : inactiveClass}`;
  };

  return (<>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col pb-16 sm:pb-0">
      {/* Refined Header - Compact on Mobile */}
      <header className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700 sticky top-0 z-40">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition duration-150 ease-in-out">
            Fuelog
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center space-x-3 sm:space-x-4">
            <Link to="/" className={getNavLinkClass("/")}>Log</Link>
            <Link to="/history" className={getNavLinkClass("/history")}>History</Link>
            <Link to="/import" className={getNavLinkClass("/import")}>Import</Link>
            <Link to="/profile" className={getNavLinkClass("/profile")}>Profile</Link>
            <Link to="/map" className={getNavLinkClass("/map")}>Map</Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <ThemeToggle />
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden xs:inline">
              {user?.displayName?.split(' ')[0] || 'User'}
            </span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-1.5 rounded-md transition-colors"
              title="Sign Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      <SyncStatus />

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl">
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