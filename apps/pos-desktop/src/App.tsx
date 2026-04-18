import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth-store';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import POS from './pages/POS';
import { ShiftGateScreen } from './components/shift/ShiftGateScreen';
import { useEffect } from 'react';
import { Toaster } from 'sonner';

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <>
      <Toaster richColors theme="dark" position="top-right" />
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/shift-gate" 
            element={
              <ProtectedRoute>
                <ShiftGateScreen />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/pos" 
            element={
              <ProtectedRoute>
                <POS />
              </ProtectedRoute>
            } 
          />
          <Route path="/" element={<Navigate to="/pos" replace />} />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </HashRouter>
    </>
  );
}

export default App;
