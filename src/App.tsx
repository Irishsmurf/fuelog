// src/App.jsx
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import QuickLogPage from './pages/QuickLogPage';
import HistoryPage from './pages/HistoryPage'; // Import HistoryPage when created
import ImportPage from './pages/ImportPage';
import { Analytics } from "@vercel/analytics/react"

// Import HistoryPage later when created
// import HistoryPage from './pages/HistoryPage';

// Component shown when the user is authenticated
function AuthenticatedApp() {
  const { user, logout } = useAuth();

  return (
    // Add a light gray background to the entire page container
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        {/* Use container, padding, flexbox for alignment */}
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          {/* App Title */}
          <Link to="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-800 transition duration-150 ease-in-out">
            Fuel Logger
          </Link>
          {/* Navigation and User Info */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Navigation Links */}
            <Link
              to="/"
              className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition duration-150 ease-in-out"
              aria-current="page" // Indicate current page if logic is added
            >
              Log Fuel
            </Link>
            {/* Placeholder link for History page */}
            <Link to="/history" className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition duration-150 ease-in-out">History</Link>
            <Link to="/import" className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-100 rounded-md transition duration-150 ease-in-out">Import</Link>

            {/* User Info - hidden on extra small screens */}
            <span className="text-sm text-gray-600 hidden sm:inline">
              Hi, {user?.displayName?.split(' ')[0] || 'User'}! {/* Show first name */}
            </span>
            {/* Logout Button */}
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium py-1.5 px-3 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150 ease-in-out"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>
      {/* Main content area with padding */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* --- Define Routes Here --- */}
        <Routes>
          <Route path="/" element={<QuickLogPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// Component to decide whether to show Login or AuthenticatedApp
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    // Basic full-page loading indicator centered using flexbox
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <p className="text-gray-500 animate-pulse">Loading Authentication...</p>
        {/* Consider adding a more visual spinner component */}
      </div>
    );
  }
  // Render Login or the main AuthenticatedApp based on user state
  return user ? <AuthenticatedApp /> : <Login />;
}

// Main App component wrapping everything
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
        <Analytics />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
