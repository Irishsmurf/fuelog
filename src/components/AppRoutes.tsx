import { Routes, Route } from 'react-router-dom';
import QuickLogPage from '../pages/QuickLogPage';
import HistoryPage from '../pages/HistoryPage';
import ImportPage from '../pages/ImportPage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import FuelMapPage from './FuelMapPage';
import { Navigate } from 'react-router-dom';
import VehicleManagementPage from '../pages/VehicleManagementPage';


function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<QuickLogPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/map" element={<FuelMapPage />} />
            <Route path="/vehicles" element={<VehicleManagementPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default AppRoutes;