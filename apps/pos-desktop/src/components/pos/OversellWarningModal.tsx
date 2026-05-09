import { useState } from 'react';
import { AlertTriangle, Lock, Loader2, X } from 'lucide-react';

export interface OversellItem {
  productName: string;
  requested: number;
  available: number;
}

interface OversellWarningModalProps {
  isOpen: boolean;
  items: OversellItem[];
  onApprove: () => void;
  onCancel: () => void;
}

type ModalState = 'warning' | 'pin';

export const OversellWarningModal: React.FC<OversellWarningModalProps> = ({
  isOpen,
  items,
  onApprove,
  onCancel,
}) => {
  const [state, setState] = useState<ModalState>('warning');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleCancel = () => {
    setState('warning');
    setPin('');
    setError('');
    onCancel();
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || isValidating) return;
    setIsValidating(true);
    setError('');
    try {
      const result = await window.ipcRenderer.invoke('pin:validate', pin);
      if (result === null) {
        setError('PIN Owner belum dikonfigurasi. Hubungi Administrator.');
      } else if (result === true) {
        setPin('');
        setError('');
        setState('warning');
        onApprove();
      } else {
        setError('PIN tidak valid.');
      }
    } catch {
      setError('Gagal memvalidasi PIN. Coba lagi.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">

        {state === 'warning' ? (
          <>
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Stok Tidak Mencukupi
              </h2>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-neutral-400">
                Produk berikut melebihi stok yang tersedia. Diperlukan otorisasi Owner untuk melanjutkan.
              </p>

              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                    <p className="text-sm font-bold text-orange-300 truncate">{item.productName}</p>
                    <p className="text-xs text-orange-400/70 mt-1">
                      Diminta: <span className="font-bold">{item.requested}</span>
                      {' · '}
                      Tersedia: <span className="font-bold">{item.available}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-bold rounded-2xl transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => setState('pin')}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-400 text-neutral-950 font-black rounded-2xl transition-all"
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand-400" />
                Otorisasi Owner
              </h2>
              <button
                onClick={() => { setState('warning'); setPin(''); setError(''); }}
                disabled={isValidating}
                className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors disabled:opacity-30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="p-6 space-y-6">
              <p className="text-sm text-neutral-400 text-center">
                Masukkan PIN Owner untuk menyetujui penjualan melebihi stok.
              </p>

              <div>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
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
                {isValidating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</>
                  : 'Verifikasi & Lanjutkan'
                }
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
