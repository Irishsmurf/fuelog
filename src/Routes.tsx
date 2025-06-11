import { JSX } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import QuickLogPage from './pages/QuickLogPage';
import HistoryPage from './pages/HistoryPage';
import ImportPage from './pages/ImportPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import FuelMapPage from './components/FuelMapPage';

function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<QuickLogPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/map" element={<FuelMapPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
