// src/App.tsx
import { JSX } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
// Import Theme context provider and hook
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import QuickLogPage from './pages/QuickLogPage';
import HistoryPage from './pages/HistoryPage';
import ImportPage from './pages/ImportPage';
import { Analytics } from '@vercel/analytics/react';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import FuelMapPage from './components/FuelMapPage';
import ThemeToggle from './components/ThemeToggle';

/** Component shown when the user IS authenticated */
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Update header background/shadow for dark mode */}
      <header className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700 sticky top-0 z-10">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition duration-150 ease-in-out">
            Fuelog
          </Link>
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Navigation Links (styles updated via getNavLinkClass) */}
            <Link to="/" className={getNavLinkClass("/")}>Log</Link>
            <Link to="/history" className={getNavLinkClass("/history")}>History</Link>
            <Link to="/import" className={getNavLinkClass("/import")}>Import</Link>
            <Link to="/map" className={getNavLinkClass("/map")}>Map</Link>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
              Hi, {user?.displayName?.split(' ')[0] || 'User'}!
            </span>
            {/* Logout Button Styling */}
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium py-1.5 px-3 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition duration-150 ease-in-out"
              title="Sign Out"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Routes remain the same */}
        <Routes>
          <Route path="/" element={<QuickLogPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/map" element={<FuelMapPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8 py-4">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} Fuelog | {/* Add Link to Privacy Policy */}
              <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 underline">
                  Privacy Policy
              </Link>
          </div>
      </footer>
    </div>
  </>);
}

/** Component deciding Login vs AuthenticatedApp */
function AppContent(): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    // Ensure loading indicator respects dark mode
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading Authentication...</p>
        </div>
    );
  }
  return user ? <AuthenticatedApp /> : <Login />;
}

/** Root App component */
function App(): JSX.Element {
  return (
    // Wrap with BOTH AuthProvider and ThemeProvider
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
          <Analytics />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
