import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Layout from './components/Layout';
import Monitors from './pages/Monitors';
import Tasks from './pages/Tasks';

function RequireAuth({ children }) {
  const token = localStorage.getItem('sentinel_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#fafafa',
            border: '1px solid #27272a',
            fontSize: '14px',
          },
        }}
      />

      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/monitors" element={<Monitors />} />
          <Route path="/tasks" element={<Tasks />} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
