import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { useShiftStore } from '@/store/shift-store';
import { apiClient } from '@/lib/api-client';
import { Lock, Plus, Users, ArrowRight, Loader2 } from 'lucide-react';
import { OpenShiftDialog } from './OpenShiftDialog';
import { JoinShiftScreen } from './JoinShiftScreen';
import { SettlementDialog } from './SettlementDialog';

export const ShiftGateScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { activeShift, setActiveShift, setActiveCashier, setShiftLoading, isShiftLoading } = useShiftStore();
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkActiveShift = async () => {
    setShiftLoading(true);
    try {
      const res = await apiClient(`/pos/shifts?branchId=1`); // Default branch 1
      setActiveShift(res);

      // Auto-restore: jika user sudah join shift ini sebelumnya (e.g. setelah restart app),
      // langsung set activeCashierId dan navigate ke POS tanpa perlu klik "Mulai Kerja" lagi.
      if (res && user) {
        const joinedIds = (res.joinedCashierIds || []) as number[];
        if (joinedIds.includes(user.id)) {
          setActiveCashier(user.id);
          navigate('/pos');
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setShiftLoading(false);
    }
  };

  useEffect(() => {
    checkActiveShift();
  }, []);

  if (isShiftLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0d0d0d] text-white">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
          <span className="text-neutral-400 font-medium">Memeriksa status shift...</span>
        </div>
      </div>
    );
  }

  // Case 1: Active shift exists
  if (activeShift) {
    const assignedCashiers = activeShift.assignedCashiers as number[];
    const isAssigned = assignedCashiers.includes(user?.id || 0);

    if (isAssigned) {
      return <JoinShiftScreen />;
    }

    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0d0d0d] p-6">
        <div className="max-w-md w-full bg-[#111] border border-white/5 rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Akses Dibatasi</h1>
          <p className="text-neutral-400 mb-8">
            Kamu tidak ditugaskan di shift ini. Silakan hubungi Manager jika ini adalah kesalahan.
          </p>
          <div className="flex flex-col space-y-3">
            <button 
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-2xl transition-all"
            >
              Kembali ke Login
            </button>

            {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
              <button 
                onClick={() => setShowSettlementDialog(true)}
                className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold rounded-2xl border border-red-500/20 transition-all"
              >
                Tutup Shift (Admin)
              </button>
            )}
          </div>
        </div>

        <SettlementDialog 
          isOpen={showSettlementDialog} 
          onClose={() => setShowSettlementDialog(false)} 
          onSuccess={() => checkActiveShift()} 
        />
      </div>
    );
  }

  // Case 2: No active shift
  const canOpenShift = user?.role === 'MANAGER' || user?.role === 'OWNER';

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#0d0d0d] p-6 text-white">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 bg-brand-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-brand-500/20">
          <Users className="w-12 h-12 text-brand-400" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Shift Belum Dibuka</h1>
        <p className="text-neutral-400 mb-10 text-lg">
          Belum ada shift aktif di cabang ini. {canOpenShift ? 'Silakan buka shift baru untuk memulai transaksi.' : 'Harap hubungi Manager untuk membuka shift.'}
        </p>

        {canOpenShift ? (
          <button 
            onClick={() => setShowOpenDialog(true)}
            className="w-full flex items-center justify-center space-x-3 py-5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-500/20 group"
          >
            <Plus className="w-6 h-6" />
            <span className="text-lg">Buka Shift Baru</span>
            <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </button>
        ) : (
          <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl text-red-400 font-medium">
            Hanya Manager atau Owner yang dapat membuka shift baru.
          </div>
        )}
      </div>

      {showOpenDialog && (
        <OpenShiftDialog 
          isOpen={showOpenDialog} 
          onClose={() => setShowOpenDialog(false)} 
          onSuccess={checkActiveShift}
        />
      )}
    </div>
  );
};
