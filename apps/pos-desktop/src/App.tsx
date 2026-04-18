import { useAuthStore } from './store/auth-store';
import Login from './pages/Login';
import { useEffect } from 'react';

function App() {
  const { isAuthenticated, user, logout, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-8">
      <div className="bg-neutral-900 border border-white/5 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-fade-in">
        <h1 className="text-2xl font-bold mb-2">Selamat Datang, {user?.name}!</h1>
        <p className="text-neutral-500 mb-8">{user?.branch} &bull; {user?.role}</p>
        
        <div className="bg-brand-500/10 border border-brand-500/20 p-4 rounded-xl text-brand-400 mb-8 text-sm">
          Semua sistem fondasi Phase 1 (API, DB, Auth) sudah aktif.
        </div>

        <button 
          onClick={logout}
          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl transition-all active:scale-95"
        >
          Keluar dari Sistem
        </button>
      </div>
    </div>
  );
}

export default App;
