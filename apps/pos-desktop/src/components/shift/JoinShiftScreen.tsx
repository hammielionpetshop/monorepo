import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { useShiftStore } from '@/store/shift-store';
import { apiClient } from '@/lib/api-client';
import { User, Play, CheckCircle2, Clock, MapPin, Loader2, Users, StopCircle, LayoutDashboard } from 'lucide-react';
import { formatRupiah, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SettlementDialog } from './SettlementDialog';
import { ForceCloseDialog } from './ForceCloseDialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const JoinShiftScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeShift, setActiveCashier, checkActiveShift } = useShiftStore();
  const [isJoining, setIsJoining] = useState(false);
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [showForceCloseDialog, setShowForceCloseDialog] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const users = await apiClient('/pos/users?branchId=1');
        setAllUsers(users);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleJoin = async () => {
    if (!activeShift || !user) return;
    setIsJoining(true);
    try {
      await apiClient(`/pos/shifts/${activeShift.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ cashierId: user.id }),
      });
      setActiveCashier(user.id);
      toast.success('Sesi kerja dimulai');
      navigate('/pos');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai sesi kerja');
    } finally {
      setIsJoining(false);
    }
  };

  if (!activeShift) return null;

  const assignedCashierIds = activeShift.assignedCashiers as number[];
  const joinedCashierIds = (activeShift as any).joinedCashierIds || [];
  const isManagerOrOwner = user?.role === 'MANAGER' || user?.role === 'OWNER' || user?.role === 'ADMIN';

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#0d0d0d] p-6 text-white overflow-hidden">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

        {/* Left Side: Shift Info */}
        <div className="space-y-8">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-full text-brand-400 font-bold uppercase tracking-widest text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
            </span>
            <span>Shift #{activeShift.shiftNumber} Sedang Aktif</span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
            Selamat Datang <br /> di <span className="text-brand-500">Hammielion POS</span>
          </h1>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-[#111] border border-white/5 rounded-3xl space-y-2">
              <Clock className="w-5 h-5 text-neutral-500" />
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Waktu Buka</p>
              <p className="text-xl font-bold">{new Date(activeShift.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div className="p-6 bg-[#111] border border-white/5 rounded-3xl space-y-2">
              <MapPin className="w-5 h-5 text-neutral-500" />
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Modal Awal</p>
              <p className="text-xl font-bold">{formatRupiah(parseFloat(activeShift.openingCash as any))}</p>
            </div>
          </div>

          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full group relative flex items-center justify-center space-x-4 py-6 bg-white hover:bg-neutral-200 text-black font-extrabold rounded-3xl transition-all shadow-2xl shadow-white/10"
          >
            {isJoining ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <span className="text-2xl">Mulai Kerja</span>
                <Play className="w-6 h-6 fill-current" />
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center justify-center space-x-2 py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold rounded-3xl border border-red-500/20 transition-all text-sm mb-2"
          >
            <LayoutDashboard className="w-4 h-4 ml-[-4px] mr-1" />
            <span>Kembali ke Dashboard</span>
          </button>

          <button
            onClick={() => setShowSettlementDialog(true)}
            className="w-full flex items-center justify-center space-x-2 py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-bold rounded-3xl border border-white/5 transition-all text-sm"
          >
            <StopCircle className="w-4 h-4" />
            <span>Tutup Shift Sekarang</span>
          </button>

          {isManagerOrOwner && (
            <button
              onClick={() => setShowForceCloseDialog(true)}
              className="w-full flex items-center justify-center space-x-2 py-3 text-neutral-600 hover:text-red-500 font-bold transition-all text-xs uppercase tracking-widest"
            >
              <span>Force Close (Darurat)</span>
            </button>
          )}
        </div>

        {/* Right Side: Assigned Cashiers */}
        <div className="bg-[#111] border border-white/5 rounded-[40px] p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center space-x-2">
              <Users className="w-5 h-5 text-neutral-500" />
              <span>Tim yang Bertugas</span>
            </h3>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {joinedCashierIds.length} / {assignedCashierIds.length} Absen
            </span>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {assignedCashierIds.map((id) => {
              const u = allUsers.find(x => x.id === id);
              const isJoined = joinedCashierIds.includes(id);
              const isMe = id === user?.id;

              return (
                <div
                  key={id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-3xl border transition-all",
                    isJoined ? "bg-emerald-500/5 border-emerald-500/20" : "bg-black/40 border-white/5",
                    isMe && !isJoined && "border-brand-500/30 ring-1 ring-brand-500/20"
                  )}
                >
                  <div className="flex items-center space-x-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                      isJoined ? "bg-emerald-500 text-white" : "bg-neutral-800 text-neutral-500"
                    )}>
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-bold text-lg">{u?.name || 'Loading...'}</p>
                        {isMe && <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">ME</span>}
                      </div>
                      <p className="text-xs uppercase font-bold tracking-widest text-neutral-500">{u?.role || '---'}</p>
                    </div>
                  </div>
                  {isJoined ? (
                    <div className="flex flex-col items-end">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-tighter mt-1">Aktif</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-tighter italic">Belum Bergabung</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-neutral-500 font-medium">
            Ketuk tombol di samping untuk mulai memproses transaksi pada shift ini.
          </p>
        </div>

      </div>

      <SettlementDialog
        isOpen={showSettlementDialog}
        onClose={() => setShowSettlementDialog(false)}
        onSuccess={() => checkActiveShift()}
      />

      <ForceCloseDialog
        isOpen={showForceCloseDialog}
        onClose={() => setShowForceCloseDialog(false)}
      />
    </div>
  );
};
