import { JSX } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { History, Map as MapIcon, User, PlusCircle, Fuel, LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Mobile-first bottom navigation component.
 * Positioned fixed at the bottom of the screen.
 */
const BottomNav = (): JSX.Element => {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: '/', label: t('nav.log'), icon: PlusCircle },
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/history', label: t('nav.history'), icon: History },
    { path: '/map', label: t('nav.map'), icon: MapIcon },
    { path: '/stations', label: t('nav.stations'), icon: Fuel },
    { path: '/profile', label: t('nav.profile'), icon: User },
  ];


  return (
    <nav className="sm:hidden glass-nav">
      <div className="grid items-center h-16" style={{ gridTemplateColumns: "repeat(" + navItems.length + ", minmax(0, 1fr))" }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors duration-200 active:scale-95 ${
                isActive
                  ? 'text-brand-primary-hover dark:text-brand-primary'
                  : 'text-gray-500 hover:text-brand-primary-hover dark:hover:text-brand-primary'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[8px] px-1 w-full text-center uppercase font-bold tracking-wider truncate">
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
