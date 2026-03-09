import { useState, useEffect, JSX } from 'react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../firebase/config';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Component to display the current network and Firestore sync status.
 */
const SyncStatus = (): JSX.Element => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let syncTimer: NodeJS.Timeout;

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      // We also add a timeout just in case nothing is actually pending
      syncTimer = setTimeout(() => setIsSyncing(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for Firestore sync events
    const unsubscribe = onSnapshotsInSync(db, () => {
      // When this fires, it means Firestore has finished syncing current local changes
      setIsSyncing(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      if (syncTimer) clearTimeout(syncTimer);
    };
  }, []);

  if (isOnline && !isSyncing) return <></>;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`px-3 py-1.5 rounded-full shadow-lg border flex items-center space-x-2 text-[10px] font-bold uppercase tracking-wider ${
        !isOnline 
          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' 
          : 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800'
      }`}>
        {!isOnline ? (
          <>
            <WifiOff size={12} />
            <span>Offline Mode</span>
          </>
        ) : (
          <>
            <RefreshCw size={12} className="animate-spin" />
            <span>Syncing Data...</span>
          </>
        )}
      </div>
    </div>
  );
};

export default SyncStatus;
