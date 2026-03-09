// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';
import './i18n';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  // 10% of transactions — well within the free tier for this traffic level
  tracesSampleRate: 0.1,
  // Only send errors in production to avoid noise during development
  enabled: import.meta.env.PROD,
});

// Capture unhandled promise rejections that slip past try/catch blocks
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', {
    reason: (event.reason as Error)?.message ?? event.reason,
    stack: (event.reason as Error)?.stack,
  });
  Sentry.captureException(event.reason);
});

// Get the root element from index.html where the React app will be mounted
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element with ID 'root'. Check your index.html file.");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
