import { JSX } from 'react';
import { Link } from 'react-router-dom';

function Footer(): JSX.Element {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-8 py-4">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} Fuelog |{' '}
        <Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 underline">
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}

export default Footer;
