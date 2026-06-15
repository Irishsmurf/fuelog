import { JSX } from 'react';
import { useAuth } from '../context/AuthContext';
import Login from './Login';
import AuthenticatedApp from './AuthenticatedApp';

/** Component deciding Login vs AuthenticatedApp */
function AppContent(): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-[#0A0F1E] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
        <p className="font-mono text-[10px] text-gray-600 uppercase tracking-[0.2em] animate-pulse">Fuelog</p>
      </div>
    );
  }
  return user ? <AuthenticatedApp /> : <Login />;
}

export default AppContent;