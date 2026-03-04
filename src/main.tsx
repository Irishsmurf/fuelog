// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
