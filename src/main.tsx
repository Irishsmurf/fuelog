// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client'; // Import the client-specific entry point
import App from './App.tsx'; // Import the main App component (ensure extension is .tsx)
import './index.css'; // Import the global CSS file (where Tailwind directives are)

// Get the root element from index.html where the React app will be mounted
const rootElement = document.getElementById('root');

// Ensure the root element exists before trying to render into it
if (!rootElement) {
  throw new Error("Failed to find the root element with ID 'root'. Check your index.html file.");
}

// Create a React root using the new Concurrent Mode API
const root = ReactDOM.createRoot(rootElement);

// Render the main App component into the root
root.render(
  // React.StrictMode helps identify potential problems in an application
  // It activates additional checks and warnings for its descendants.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
