// src/components/Login.tsx
import { JSX, useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext is now AuthContext.tsx

// Define the component's return type
function Login(): JSX.Element {
  const { login } = useAuth(); // Get the login function from context

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
      // Provide more specific error messages based on err.code if needed
      setError("Failed to sign in. Please try again.");
      setIsLoggingIn(false); // Set loading to false only if login fails
    }
  };

  return (
    // Full screen container, centers content using Flexbox (Tailwind)
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8 dark:bg-gray-900">
      {/* Card container with Tailwind styling */}
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8 border border-gray-200 space-y-6 dark:bg-gray-800 dark:border-gray-700">
        {/* Header Section */}
        <div className="text-center">
          {/* Optional: Add a logo here */}
          <h2 className="mt-4 text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            Fuel Logger
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Sign in with Google to track your fuel usage.
          </p>
        </div>

        {/* Login Button */}
        <div>
          <button
            onClick={handleLoginClick}
            disabled={isLoggingIn}
            // Tailwind classes for styling the button
            className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 ease-in-out"
          >
            {/* Simple SVG for Google Logo */}
            <svg className="w-5 h-5 mr-2 -ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
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

