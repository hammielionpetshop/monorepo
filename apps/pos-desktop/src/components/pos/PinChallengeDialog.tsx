import React, { useState } from 'react';
import { X, Lock, CheckCircle2 } from 'lucide-react';

interface PinChallengeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PinChallengeDialog: React.FC<PinChallengeDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default dummy PIN for owner is '123456'
    if (pin === '123456') {
      onSuccess();
      setPin('');
      setError('');
    } else {
      setError('PIN tidak valid');
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
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-sm text-neutral-400">Masukkan 6-digit PIN Owner untuk melanjutkan tindakan ini.</p>
          </div>
          
          <div>
            <input 
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 text-center text-3xl tracking-[1em] font-black text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs text-center mt-2 font-bold">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4}
            className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl transition-all"
          >
            Verifikasi
          </button>
        </form>
      </div>
    </div>
  );
};
