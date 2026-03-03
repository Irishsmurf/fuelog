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
    <nav className="sm:hidden glass-nav">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 active:scale-90 ${
                isActive 
                  ? 'text-brand-primary' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-brand-primary'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-brand-primary/10' : ''}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'animate-in zoom-in duration-300' : ''} />
              </div>
              <span className={`text-[9px] mt-0.5 uppercase font-black tracking-widest transition-all ${isActive ? 'opacity-100 scale-110' : 'opacity-50'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
