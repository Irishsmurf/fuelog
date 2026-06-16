import { JSX } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { History, Map as MapIcon, User, PlusCircle, Fuel } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Mobile-first bottom navigation component.
 * Positioned fixed at the bottom of the screen.
 */
const BottomNav = (): JSX.Element => {
  const location = useLocation();
  const { t } = useTranslation();

  // Dashboard is intentionally omitted from the mobile bottom nav to keep
  // tap targets and labels comfortable at narrow widths (#141). It remains
  // reachable on mobile via a link on the Log page, and via the desktop top nav.
  const navItems = [
    { path: '/', label: t('nav.log'), icon: PlusCircle },
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
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 active:scale-90 ${
                isActive
                  ? 'text-brand-primary'
                  : 'text-gray-400 dark:text-gray-500 hover:text-brand-primary'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-brand-primary/10' : ''}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} className={isActive ? 'animate-in zoom-in duration-300' : ''} />
              </div>
              <span className={"text-[9px] mt-0.5 px-1 w-full text-center uppercase font-black tracking-widest transition-all truncate " + (isActive ? "opacity-100" : "opacity-50")}>
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
