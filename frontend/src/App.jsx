import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
// A temporary placeholder for our next step
const DashboardPlaceholder = () => (
  <div className="min-h-screen flex items-center justify-center text-textMuted">
    Dashboard Module Pending...
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      {/* Global Toast Notifications Config */}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#171717',
            color: '#f5f5f5',
            border: '1px solid #262626',
          },
        }} 
      />
      
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} /> 
      </Routes>
    </BrowserRouter>
  );
}