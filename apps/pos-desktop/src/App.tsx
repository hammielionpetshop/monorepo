import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth-store";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import Login from "./pages/Login";
import POS from "./pages/POS";
import { PORequestPage } from "./pages/PORequest";
import { ReceivingPage } from "./pages/Receiving";
import { DamagedGoodsPage } from "./pages/DamagedGoods";
import { ShiftGateScreen } from "./components/shift/ShiftGateScreen";
import { Dashboard } from "./pages/Dashboard";
import { HistoryPage } from "./pages/History";
import { useEffect } from "react";
import { Toaster as SonnerToaster } from "sonner";

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <>
      <SonnerToaster richColors theme="dark" position="top-right" />
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
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/po-request"
            element={
              <ProtectedRoute>
                <PORequestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receiving"
            element={
              <ProtectedRoute>
                <ReceivingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/damaged-goods"
            element={
              <ProtectedRoute>
                <DamagedGoodsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </>
  );
}

export default App;
