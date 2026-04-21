import React, { useState, useRef } from 'react';
import { X, Receipt, Camera, Save, Loader2, UploadCloud } from 'lucide-react';
import { usePOSStore } from '@/store/pos-store';
import { useShiftStore } from '@/store/shift-store';
import { useAuthStore } from '@/store/auth-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NumberInput } from '../ui/NumberInput';

interface ExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExpenseDialog: React.FC<ExpenseDialogProps> = ({ isOpen, onClose }) => {
  const { expenseCategories } = usePOSStore();
  const { activeShift, activeCashierId } = useShiftStore();
  const { user } = useAuthStore();
  
  const [categoryId, setCategoryId] = useState<number | string>('');
  const [categoryCustom, setCategoryCustom] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient('/pos/uploads', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set content-type for FormData
      });
      setProofUrl(res.url);
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const selectedCategoryId = typeof categoryId === 'number' ? categoryId : null;
    const isOther = categoryId === 'OTHER';

    if (!selectedCategoryId && !isOther) {
      toast.warning('Pilih kategori!');
      return;
    }

    if (isOther && !categoryCustom) {
      toast.warning('Isi kategori lainnya!');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient(`/pos/shifts/${activeShift.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          cashierId: activeCashierId || user?.id,
          categoryId: isOther ? null : selectedCategoryId,
          categoryCustom: isOther ? categoryCustom : null,
          amount,
          note,
          proofImage: proofUrl,
        }),
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan pengeluaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Catat Pengeluaran</h2>
              <p className="text-xs text-neutral-500 uppercase font-bold tracking-widest">Shift Expense Log</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Kategori</label>
              <select 
                value={categoryId}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategoryId(val === 'OTHER' ? 'OTHER' : Number(val));
                }}
                className="w-full bg-black border border-white/5 focus:border-brand-500 rounded-2xl py-4 px-5 text-white outline-none transition-all appearance-none"
                required
              >
                <option value="">Pilih Kategori...</option>
                {(expenseCategories || []).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
                <option value="OTHER">Lainnya...</option>
              </select>
            </div>

            {categoryId === 'OTHER' && (
              <div className="col-span-2 space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Kategori Kustom</label>
                <input 
                  type="text"
                  value={categoryCustom}
                  onChange={(e) => setCategoryCustom(e.target.value)}
                  className="w-full bg-black border border-white/5 focus:border-brand-500 rounded-2xl py-4 px-5 text-white outline-none"
                  placeholder="Sebutkan kategori..."
                  required
                />
              </div>
            )}

            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nominal (Rp)</label>
              <NumberInput 
                value={amount}
                onChange={(val) => setAmount(Number(val))}
                prefix="Rp"
                placeholder="0"
                className="text-2xl py-4"
              />
            </div>

            {/* Note */}
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Keterangan / Keperluan</label>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-black border border-white/5 focus:border-brand-500 rounded-2xl py-4 px-5 text-white outline-none resize-none h-24"
                placeholder="Contoh: Beli air galon 2 buah..."
                required
              />
            </div>

            {/* Proof Image */}
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Bukti Nota (Opsional)</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative h-32 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer group overflow-hidden",
                  proofUrl ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/5 hover:border-white/20 hover:bg-white/5"
                )}
              >
                {isUploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
                ) : proofUrl ? (
                  <div className="flex flex-col items-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Terkirim</span>
                  </div>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-neutral-600 group-hover:text-neutral-400 mb-2 transition-colors" />
                    <span className="text-xs font-bold text-neutral-500 group-hover:text-neutral-400 uppercase tracking-widest">Ambil Foto / Upload</span>
                  </>
                )}
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-2xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="flex-[2] flex items-center justify-center space-x-2 py-4 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-500/20"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Simpan Pengeluaran</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

