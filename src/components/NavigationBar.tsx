import { JSX } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';

const getNavLinkClass = (path: string, currentPath: string): string => {
  const baseClass = "px-2 py-1 text-sm font-medium rounded-md transition duration-150 ease-in-out";
  const activeClass = "bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-100";
  const inactiveClass = "text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-gray-700";
  return `${baseClass} ${currentPath === path ? activeClass : inactiveClass}`;
};

function NavigationBar(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700 sticky top-0 z-10">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition duration-150 ease-in-out">
          Fuelog
        </Link>
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Link to="/" className={getNavLinkClass("/", location.pathname)}>Log</Link>
          <Link to="/history" className={getNavLinkClass("/history", location.pathname)}>History</Link>
          <Link to="/import" className={getNavLinkClass("/import", location.pathname)}>Import</Link>
          <Link to="/map" className={getNavLinkClass("/map", location.pathname)}>Map</Link>
          <ThemeToggle />
          <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
            Hi, {user?.displayName?.split(' ')[0] || 'User'}!
          </span>
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
  );
}

export default NavigationBar;
