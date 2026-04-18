import React, { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, Plus, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { NumberInput } from '../ui/NumberInput';
import { formatRupiah, cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

interface OpenShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface User {
  id: number;
  name: string;
  role: string;
}

export const OpenShiftDialog: React.FC<OpenShiftDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user: currentUser } = useAuthStore();
  const [openingCash, setOpeningCash] = useState<number>(200000);
  const [targetEndTime, setTargetEndTime] = useState<string>('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedCashiers, setSelectedCashiers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsUsersLoading(true);
      try {
        const users = await apiClient('/pos/users?branchId=1');
        setAllUsers(users);
        // Default select current user if they are manager/owner
        if (currentUser && (currentUser.role === 'MANAGER' || currentUser.role === 'OWNER')) {
          setSelectedCashiers([currentUser.id]);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setIsUsersLoading(false);
      }
    };
    if (isOpen) fetchUsers();
  }, [isOpen]);

  const toggleCashier = (userId: number) => {
    setSelectedCashiers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCashiers.length === 0) {
      toast.warning('Pilih setidaknya satu kasir!');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient('/pos/shifts', {
        method: 'POST',
        body: JSON.stringify({
          branchId: 1,
          openingCash,
          assignedCashiers: selectedCashiers,
          targetEndTime: targetEndTime || null,
          openedById: currentUser?.id,
        }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuka shift');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-[#111] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center">
              <Plus className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Buka Shift Baru</h2>
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Shift Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Modal Awal */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">Modal Awal Sesi (Rp)</label>
            <NumberInput 
              value={openingCash}
              onChange={(val) => setOpeningCash(Number(val))}
              prefix="Rp"
              placeholder="0"
              className="text-3xl py-6 rounded-3xl"
              autoFocus
            />
          </div>

          {/* Assigned Cashiers */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              Kasir yang Ditugaskan
              <span className="text-[10px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-500">{selectedCashiers.length} Terpilih</span>
            </label>
            
            <div className="grid grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
              {isUsersLoading ? (
                <div className="col-span-2 py-10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-600" />
                </div>
              ) : allUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleCashier(u.id)}
                  className={cn(
                    "flex items-center space-x-3 p-4 rounded-2xl border transition-all text-left group",
                    selectedCashiers.includes(u.id) 
                      ? "bg-brand-500/10 border-brand-500/50 text-white" 
                      : "bg-black border-white/5 text-neutral-500 hover:border-white/20"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    selectedCashiers.includes(u.id) ? "bg-brand-500 text-white" : "bg-neutral-800 group-hover:bg-neutral-700"
                  )}>
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate leading-tight">{u.name}</p>
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Selesai */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Target Selesai (Opsional)</label>
            <div className="relative">
              <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
              <input 
                type="time"
                value={targetEndTime}
                onChange={(e) => setTargetEndTime(e.target.value)}
                className="w-full bg-black border border-white/5 focus:border-brand-500 rounded-2xl py-4 pl-14 pr-5 text-lg transition-all outline-none"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 py-5 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all shadow-xl shadow-brand-500/20"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  <span className="text-lg">Konfirmasi Buka Shift</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
