// src/App.tsx
import { JSX } from 'react';
import { BrowserRouter } from 'react-router-dom';
// Import context providers
import { RemoteConfigProvider } from './context/RemoteConfigContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ApiTokenProvider } from './context/ApiTokenContext';
import { Analytics } from '@vercel/analytics/react';
import { HelmetProvider } from 'react-helmet-async';

import AppContent from './components/AppContent';


/** Root App component */
function App(): JSX.Element {
  return (
    <HelmetProvider>
      <RemoteConfigProvider>
        <AuthProvider>
          <ApiTokenProvider>
          <ThemeProvider>
            <BrowserRouter>
              <AppContent />
              <Analytics />
            </BrowserRouter>
          </ThemeProvider>
          </ApiTokenProvider>
        </AuthProvider>
      </RemoteConfigProvider>
    </HelmetProvider>
  );
}

export default App;
