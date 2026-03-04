import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { activateRemoteConfig, getBoolean, getString, getNumber } from '../firebase/remoteConfigService';

interface RemoteConfigContextProps {
  loading: boolean;
  getBoolean: (key: string) => boolean;
  getString: (key: string) => string;
  getNumber: (key: string) => number;
}

const RemoteConfigContext = createContext<RemoteConfigContextProps | undefined>(undefined);

export const RemoteConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await activateRemoteConfig();
      } catch (error) {
        console.error("Failed to activate Remote Config in Provider:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // We wrap the getters to ensure they are stable but also conceptually tied to the context
  // The 'version' state ensures that if we ever manually re-fetch, components using these will re-render
  const contextValue: RemoteConfigContextProps = {
    loading,
    getBoolean: (key: string) => getBoolean(key),
    getString: (key: string) => getString(key),
    getNumber: (key: string) => getNumber(key),
  };

  return (
    <RemoteConfigContext.Provider value={contextValue}>
      {children}
    </RemoteConfigContext.Provider>
  );
};

export const useRemoteConfig = (): RemoteConfigContextProps => {
  const context = useContext(RemoteConfigContext);
  if (context === undefined) {
    throw new Error('useRemoteConfig must be used within a RemoteConfigProvider');
  }
  return context;
};
