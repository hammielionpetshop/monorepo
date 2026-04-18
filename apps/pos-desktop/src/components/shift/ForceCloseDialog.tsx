import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, Loader2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShiftStore } from '@/store/shift-store';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ForceCloseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForceCloseDialog: React.FC<ForceCloseDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { activeShift, clearShift } = useShiftStore();

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleForceClose = async () => {
    if (!activeShift || !user || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      await apiClient(`/pos/shifts/${activeShift.id}/force-close`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reason.trim(),
          forceClosedById: user.id,
        }),
      });

      toast.success('Shift berhasil di-force close.');
      clearShift();
      onClose();
      navigate('/shift-gate');
    } catch (err: any) {
      toast.error(err.message || 'Gagal melakukan force close shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={handleClose} />

      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-red-500/20 rounded-[40px] overflow-hidden shadow-[0_0_80px_rgba(239,68,68,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/5 bg-red-500/5">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Force Close Shift</h2>
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest mt-0.5">
                Tindakan Darurat — Tidak Dapat Dibatalkan
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-3 text-neutral-500 hover:text-white transition-colors bg-white/5 rounded-2xl disabled:opacity-30"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          {/* Warning Banner */}
          <div className="flex items-start space-x-3 p-5 bg-red-500/10 border border-red-500/20 rounded-3xl">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-red-400">Shift akan ditutup secara paksa</p>
              <p className="text-xs text-red-400/70 leading-relaxed">
                Settlement akan dikalkulasi otomatis tanpa input uang fisik. Seluruh sesi kasir yang aktif akan dihentikan. Tindakan ini dicatat sebagai <span className="font-bold text-red-400">FORCE_CLOSED</span> dalam audit log.
              </p>
            </div>
          </div>

          {/* Shift Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Shift</p>
              <p className="text-lg font-black text-white">#{activeShift?.shiftNumber}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Dilakukan Oleh</p>
              <p className="text-lg font-black text-white truncate">{user?.name}</p>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <label className="flex items-center space-x-1 text-xs font-bold text-neutral-400 uppercase tracking-widest px-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Alasan Force Close <span className="text-red-500">*</span></span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder="Masukkan alasan mengapa shift ini perlu ditutup secara paksa (contoh: kasir tidak hadir, sistem bermasalah, dll)..."
              className="w-full bg-black border border-white/10 focus:border-red-500/50 rounded-3xl py-5 px-6 text-white text-sm outline-none resize-none placeholder-neutral-600 transition-colors disabled:opacity-50"
            />
            {reason.length > 0 && reason.trim().length < 10 && (
              <p className="text-xs text-red-400 font-bold px-2">Alasan terlalu singkat (min. 10 karakter)</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 py-5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-3xl transition-all disabled:opacity-30"
            >
              Batal
            </button>
            <button
              onClick={handleForceClose}
              disabled={isSubmitting || reason.trim().length < 10}
              className="flex-[2] py-5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black rounded-3xl transition-all shadow-2xl shadow-red-500/20 flex items-center justify-center space-x-3"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Ya, Force Close Shift</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
