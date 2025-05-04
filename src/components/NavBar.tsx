// Example: src/components/Navbar.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import VehicleSelector from './VehicleSelector'; // Import the component
import ThemeToggle from './ThemeToggle'; // Assuming you have this
import { useAuth } from '../context/AuthContext'; // Assuming you have this
import { LogOut } from 'lucide-react'; // Optional: Icon for logout button

const Navbar: React.FC = () => {
    const { user, logout } = useAuth();

    return (
        <nav className="bg-white dark:bg-gray-800 shadow-md p-4">
            <div className="container mx-auto flex flex-wrap justify-between items-center"> {/* Added flex-wrap */}
                <Link to="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Fuelog</Link>

                {/* Right-aligned items */}
                <div className="flex items-center space-x-2 sm:space-x-4 order-last"> {/* Ensure theme/logout are last */}
                    {user && (
                         <button
                            onClick={logout}
                            // --- Updated Logout Button Styling ---
                            className="flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors dark:focus:ring-offset-gray-800"
                            // --- End Updated Styling ---
                         >
                            <LogOut size={16} className="mr-1 hidden sm:inline" /> {/* Optional Icon */}
                            Logout
                         </button>
                    )}
                     <ThemeToggle />
                </div>

                 {/* Navigation Links & Vehicle Selector (center or left) */}
                 <div className="flex items-center space-x-2 sm:space-x-4 mt-2 md:mt-0 w-full md:w-auto justify-center md:justify-start order-first md:order-none"> {/* Adjust order and alignment */}
                     {user && (
                        <>
                            {/* Vehicle Selector */}
                            <VehicleSelector />

                            <Link to="/quicklog" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm sm:text-base">Log Fuel</Link>
                            <Link to="/history" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm sm:text-base">History</Link>
                            <Link to="/map" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm sm:text-base">Map</Link>
                            <Link to="/vehicles" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm sm:text-base">Vehicles</Link>
                            {/* Add other links */}
                        </>
                    )}
                 </div>

            </div>
        </nav>
    );
}

export default Navbar;
