import { JSX } from 'react';
import { useAuth } from '../context/AuthContext';
import Login from './Login';
import AuthenticatedApp from './AuthenticatedApp';

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

export default AppContent;