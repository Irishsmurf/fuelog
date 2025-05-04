import { JSX } from 'react';
import { Link } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import Navbar from './NavBar';


/** Main authenticated app component */
function AuthenticatedApp(): JSX.Element {


  return (<>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Update header background/shadow for dark mode */}
      <header className="bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-700 sticky top-0 z-10">
        <Navbar />
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AppRoutes />
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

export default AuthenticatedApp;