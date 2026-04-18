import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth-store';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Login from './pages/Login';
import POS from './pages/POS';
import { useEffect } from 'react';

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
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
  );
}

export default App;
