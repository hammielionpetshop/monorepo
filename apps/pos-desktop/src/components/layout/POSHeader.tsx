import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useShiftStore } from '@/store/shift-store';
import { Store, User, LogOut, Clock, Wifi, WifiOff, Receipt, LogOut as StopIcon, Loader2 } from 'lucide-react';
import { cn, formatRupiah } from '@/lib/utils';
import { ExpenseDialog } from '../shift/ExpenseDialog';
import { SettlementDialog } from '../shift/SettlementDialog';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const POSHeader: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { activeShift, activeCashierId, clearShift } = useShiftStore();
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const userRole = user?.role?.toUpperCase();
  const isAssigned = activeShift?.assignedCashiers?.includes(user?.id);
  const canCloseShift = userRole === 'MANAGER' || userRole === 'OWNER' || isAssigned;

  const handleStopSession = async () => {
    try {
      await apiClient(`/pos/shifts/${activeShift?.id}/stop`, {
        method: 'POST',
        body: JSON.stringify({ cashierId: user?.id })
      });
      clearShift();
      logout();
      toast.success('Sesi kerja dihentikan');
    } catch (e) {
      toast.error('Gagal menghentikan sesi kerja');
    }
  };

  return (
    <header className="h-16 bg-[#111] border-b border-white/5 flex items-center justify-between px-6 z-[100]">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-brand-400">
          <Store className="w-5 h-5" />
          <span className="font-bold text-lg tracking-tight">Hammielion</span>
        </div>
        <div className="h-4 w-[1px] bg-white/10 mx-2" />
        <div className="flex flex-col">
          <span className="text-xs text-neutral-500 font-medium leading-none mb-1">CABANG</span>
          <span className="text-sm font-semibold leading-none">{user?.branch || 'Utama'}</span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        {/* Clock & Status */}
        <div className="flex items-center space-x-6 text-neutral-400">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono">{time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className={cn("text-xs font-bold uppercase tracking-wider", isOnline ? "text-emerald-500/80" : "text-red-500/80")}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="h-8 w-[1px] bg-white/5" />

        {/* Shift Management Buttons */}
        <div className="flex items-center space-x-2">
          {activeShift && (
             <div className="bg-neutral-800/50 border border-white/5 px-4 py-2 rounded-xl flex items-center space-x-3 mr-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-1">Shift Aktif</span>
                  <span className="text-xs font-bold leading-none">#{activeShift.shiftNumber} | {new Date(activeShift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
             </div>
          )}

          <button 
            onClick={() => setShowExpenseDialog(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl border border-white/5 transition-all text-sm font-bold group"
          >
            <Receipt className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
            <span>Pengeluaran</span>
          </button>

          {canCloseShift && (
            <button 
              onClick={() => setShowSettlementDialog(true)}
              className="flex items-center space-x-2 px-4 py-2.5 bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white rounded-xl border border-brand-500/20 transition-all text-sm font-bold group"
            >
              <StopIcon className="w-4 h-4" />
              <span>Tutup Shift</span>
            </button>
          )}
        </div>

        <div className="h-8 w-[1px] bg-white/5" />

        {/* User Profile */}
        <div className="flex items-center space-x-4 group">
          <div className="flex flex-col text-right">
            <span className="text-sm font-bold leading-none mb-1">{user?.name}</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">{user?.role}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-white/10 flex items-center justify-center group-hover:bg-neutral-700 transition-colors">
            <User className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
          </div>
          <button 
            onClick={async () => {
              if (activeShift && user) {
                setShowStopConfirm(true);
              } else {
                logout();
              }
            }}
            className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ExpenseDialog isOpen={showExpenseDialog} onClose={() => setShowExpenseDialog(false)} />
      <SettlementDialog isOpen={showSettlementDialog} onClose={() => setShowSettlementDialog(false)} />
      
      <ConfirmDialog 
        isOpen={showStopConfirm}
        onClose={() => setShowStopConfirm(false)}
        onConfirm={handleStopSession}
        title="Stop Sesi Kerja"
        message="Berhenti sesi kerja sekarang? Data shift tetap tersimpan dan shift tetap terbuka untuk kasir lain."
        confirmLabel="Ya, Berhenti"
        variant="warning"
      />
    </header>
  );
};
