// src/App.tsx
import { JSX } from 'react';
import { BrowserRouter } from 'react-router-dom';
// Import context providers
import { RemoteConfigProvider } from './context/RemoteConfigContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Analytics } from '@vercel/analytics/react';

import AppContent from './components/AppContent';


/** Root App component */
function App(): JSX.Element {
  return (
    <RemoteConfigProvider>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AppContent />
            <Analytics />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </RemoteConfigProvider>
  );
}

export default App;
