import { JSX } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { History, Map as MapIcon, User, PlusCircle } from 'lucide-react';

/**
 * Mobile-first bottom navigation component.
 * Positioned fixed at the bottom of the screen.
 */
const BottomNav = (): JSX.Element => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Log', icon: PlusCircle },
    { path: '/history', label: 'History', icon: History },
    { path: '/map', label: 'Map', icon: MapIcon },
    { path: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors duration-150 ${
                isActive 
                  ? 'text-indigo-600 dark:text-indigo-400' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-300'
              }`}
            >
              <Icon size={20} className={isActive ? 'animate-in fade-in zoom-in duration-300' : ''} />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
