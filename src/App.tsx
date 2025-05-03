// src/App.tsx
import { JSX } from 'react';
import { BrowserRouter } from 'react-router-dom';
// Import Theme context provider and hook
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Analytics } from '@vercel/analytics/react';

import AppContent from './components/AppContent';


/** Root App component */
function App(): JSX.Element {
  return (
    // Wrap with BOTH AuthProvider and ThemeProvider
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
          <Analytics />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
