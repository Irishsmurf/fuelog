// src/App.tsx
import { JSX } from 'react';
import { BrowserRouter } from 'react-router-dom';
// Import context providers
import { RemoteConfigProvider } from './context/RemoteConfigContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ApiTokenProvider } from './context/ApiTokenContext';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './data/queryClient';

import AppContent from './components/AppContent';
import ErrorBoundary from './components/ErrorBoundary';


/** Root App component */
function App(): JSX.Element {
  return (
    <HelmetProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
        <RemoteConfigProvider>
          <AuthProvider>
            <ApiTokenProvider>
            <ThemeProvider>
              <BrowserRouter>
                <AppContent />
                <Analytics />
                <SpeedInsights />
              </BrowserRouter>
            </ThemeProvider>
            </ApiTokenProvider>
          </AuthProvider>
        </RemoteConfigProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
