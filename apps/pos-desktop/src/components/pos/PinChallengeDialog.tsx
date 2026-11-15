import React, { useState } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';

interface PinChallengeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinChallengeDialog: React.FC<PinChallengeDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || isValidating) return;
    setIsValidating(true);
    setError('');
    try {
      const result = await window.ipcRenderer.invoke('pin:validate', pin);
      if (result === null) {
        // null = PIN belum dikonfigurasi di safeStorage
        setError('PIN Owner belum dikonfigurasi. Hubungi Administrator.');
      } else if (result === true) {
        onSuccess();
        setPin('');
        setError('');
      } else {
        setError('PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar.');
      }
    } catch {
      setError('Gagal memvalidasi PIN. Coba lagi.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-brand-400" />
            Otorisasi Owner
          </h2>
          <button
            onClick={onClose}
            disabled={isValidating}
            className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-sm text-neutral-400 text-center">Masukkan 6-digit PIN Owner untuk melanjutkan tindakan ini.</p>

          <div>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setPin(val);
                setError('');
              }}
              disabled={isValidating}
              className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 text-center text-3xl tracking-[1em] font-black text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono disabled:opacity-50"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs text-center mt-2 font-bold">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || isValidating}
            className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {isValidating ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</> : 'Verifikasi'}
          </button>
        </form>
      </div>
    </div>
  );
};
