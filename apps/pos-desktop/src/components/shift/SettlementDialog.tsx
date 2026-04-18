import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calculator, ArrowRight, AlertTriangle, Printer, CheckCircle2, Loader2, Info } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useShiftStore } from '@/store/shift-store';
import { useAuthStore } from '@/store/auth-store';
import { formatRupiah, cn } from '@/lib/utils';
import { ShiftBreakdownSummary, ShiftCashierBreakdown } from '@petshop/shared';
import { printService } from '@/lib/print-service';
import { toast } from 'sonner';
import { NumberInput } from '../ui/NumberInput';

interface SettlementDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'BREAKDOWN' | 'INPUT' | 'CONFIRM';

export const SettlementDialog: React.FC<SettlementDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { activeShift, clearShift } = useShiftStore();
  
  const [step, setStep] = useState<Step>('BREAKDOWN');
  const [summary, setSummary] = useState<ShiftBreakdownSummary | null>(null);
  const [cashierInputs, setCashierInputs] = useState<Array<{ cashierId: number, realCash: number }>>([]);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeShift) {
      fetchBreakdown();
    }
  }, [isOpen, activeShift]);

  const fetchBreakdown = async () => {
    if (!activeShift) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient(`/pos/shifts/${activeShift.id}/breakdown`);
      setSummary(data);
      // Initialize inputs with expected cash
      setCashierInputs(data.breakdowns.map((b: ShiftCashierBreakdown) => ({
        cashierId: b.cashierId,
        realCash: b.expectedCash
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRealCash = (cashierId: number, val: number) => {
    setCashierInputs(prev => prev.map(i => i.cashierId === cashierId ? { ...i, realCash: val } : i));
  };

  const handleSettle = async () => {
    if (!activeShift) return;
    setIsSubmitting(true);
    try {
      const finalSummary = await apiClient(`/pos/shifts/${activeShift.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({
          cashierInputs,
          settlementNotes,
          closedById: currentUser?.id,
        }),
      });

      // Trigger Print (3 copies)
      await printService.printSettlementReport(finalSummary, 3);

      toast.success('Shift berhasil ditutup dan laporan dicetak.');
      clearShift();
      onClose();
      navigate('/shift-gate');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menutup shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/5">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-400">
              <Calculator className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white px-1">Settlement Shift #{activeShift?.shiftNumber}</h2>
              <div className="flex items-center space-x-4 mt-1">
                <StepBadge active={step === 'BREAKDOWN'} label="1. Review Penjualan" />
                <ArrowRight className="w-4 h-4 text-neutral-800" />
                <StepBadge active={step === 'INPUT'} label="2. Input Uang Fisik" />
                <ArrowRight className="w-4 h-4 text-neutral-800" />
                <StepBadge active={step === 'CONFIRM'} label="3. Konfirmasi & Cetak" />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 text-neutral-500 hover:text-white transition-colors bg-white/5 rounded-2xl">
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-brand-500" />
              <p className="text-neutral-500 font-bold uppercase tracking-widest text-sm">Menghitung Breakdown...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Gagal Memuat Data</h3>
              <p className="text-red-400 font-medium">{error}</p>
              <button onClick={fetchBreakdown} className="mt-6 px-6 py-3 bg-red-500 text-white font-bold rounded-2xl">Coba Lagi</button>
            </div>
          ) : (
            <>
              {step === 'BREAKDOWN' && summary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="px-6 py-2">Kasir</th>
                          <th className="px-4 py-2 text-right">Cash</th>
                          <th className="px-4 py-2 text-right">QRIS/Debit</th>
                          <th className="px-4 py-2 text-right">Piutang</th>
                          <th className="px-4 py-2 text-right">Pengeluaran</th>
                          <th className="px-4 py-2 text-right">Expected Cash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.breakdowns.map((b) => (
                          <tr key={b.cashierId} className="bg-white/5 overflow-hidden group">
                            <td className="px-6 py-5 rounded-l-3xl">
                              <p className="font-bold text-white">{b.cashierName}</p>
                              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Total {b.totalTransactions} Trx</p>
                            </td>
                            <td className="px-4 py-5 text-right font-mono text-emerald-400 font-bold">{formatRupiah(b.totalSalesCash)}</td>
                            <td className="px-4 py-5 text-right font-mono text-neutral-400">{formatRupiah(b.totalSalesQris + b.totalSalesDebit + b.totalSalesCredit)}</td>
                            <td className="px-4 py-5 text-right font-mono text-amber-500/80">{formatRupiah(b.totalSalesDebt)}</td>
                            <td className="px-4 py-5 text-right font-mono text-red-400">{formatRupiah(b.totalExpenses)}</td>
                            <td className="px-4 py-5 text-right font-mono text-white font-black rounded-r-3xl text-lg">{formatRupiah(b.expectedCash)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-8 bg-brand-500/5 border border-brand-500/10 rounded-[32px] flex items-center justify-between">
                    <div>
                      <h4 className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Total Kas Harus Ada (Expected)</h4>
                      <p className="text-4xl font-black text-white">{formatRupiah(summary.totalExpectedCash)}</p>
                    </div>
                    <button 
                      onClick={() => setStep('INPUT')}
                      className="px-8 py-5 bg-brand-500 hover:bg-brand-400 text-white font-black rounded-2xl transition-all shadow-xl shadow-brand-500/20 flex items-center space-x-3 group"
                    >
                      <span>Lanjut Input Uang Fisik</span>
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {step === 'INPUT' && summary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {summary.breakdowns.map((b) => {
                      const input = cashierInputs.find(i => i.cashierId === b.cashierId);
                      const real = input?.realCash || 0;
                      const variance = real - b.expectedCash;
                      const isNegative = variance < 0;

                      return (
                        <div key={b.cashierId} className={cn(
                          "p-8 rounded-[32px] border transition-all space-y-6",
                          isNegative ? "bg-red-500/5 border-red-500/20" : "bg-white/5 border-white/5"
                        )}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-black text-xl text-white">{b.cashierName}</p>
                              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">Expected: {formatRupiah(b.expectedCash)}</p>
                            </div>
                            {isNegative && (
                              <div className="flex items-center space-x-1 px-3 py-1 bg-red-500 text-white rounded-full text-[10px] font-black uppercase tracking-tighter">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Selisih Kurang</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Jumlah Uang Real (Rp)</label>
                             <NumberInput 
                               value={real}
                               onChange={(val) => updateRealCash(b.cashierId, Number(val))}
                               prefix="Rp"
                               placeholder="0"
                               className="py-6 pl-16 pr-6 text-4xl font-black rounded-3xl"
                               autoFocus={b === summary.breakdowns[0]}
                             />
                          </div>

                          <div className="flex items-center justify-between px-2">
                             <span className="text-sm font-bold text-neutral-500">Selisih:</span>
                             <span className={cn("text-2xl font-black font-mono", isNegative ? "text-red-500" : "text-emerald-500")}>
                               {variance >= 0 ? '+' : ''}{formatRupiah(variance)}
                             </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button onClick={() => setStep('BREAKDOWN')} className="px-8 py-5 text-neutral-500 font-bold transition-all">Kembali</button>
                    <button 
                      onClick={() => setStep('CONFIRM')}
                      className="px-12 py-5 bg-white text-black font-black rounded-3xl transition-all shadow-xl shadow-white/10 flex items-center space-x-3"
                    >
                      <span>Review Final</span>
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {step === 'CONFIRM' && summary && (
                <div className="space-y-8 max-w-2xl mx-auto">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-emerald-500/10 rounded-[32px] flex items-center justify-center mx-auto text-emerald-500">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h3 className="text-3xl font-black text-white">Konfirmasi Settlement</h3>
                    <p className="text-neutral-500 font-medium">Laporan akan segera dicetak 3 rangkap dan shift akan ditutup secara permanen.</p>
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-[32px] divide-y divide-white/5 overflow-hidden">
                    <div className="p-6 flex justify-between items-center">
                      <span className="text-neutral-400 font-bold">Total Uang Real Setor</span>
                      <span className="text-2xl font-black text-white">{formatRupiah(cashierInputs.reduce((sum, i) => sum + i.realCash, 0))}</span>
                    </div>
                    {cashierInputs.some((i, idx) => i.realCash < summary.breakdowns[idx].expectedCash) && (
                      <div className="p-6 bg-red-500/10 flex items-start space-x-3">
                        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                        <p className="text-red-400 text-sm font-bold leading-relaxed uppercase tracking-tight">
                          PERHATIAN: Terdapat selisih kurang pada kas. Selisih ini akan tercatat dalam laporan settlement permanen.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em] px-2">Catatan Settlement (Opsional)</label>
                    <textarea 
                      value={settlementNotes}
                      onChange={(e) => setSettlementNotes(e.target.value)}
                      className="w-full bg-black border border-white/5 focus:border-brand-500 rounded-3xl py-6 px-6 text-white outline-none resize-none h-32"
                      placeholder="Masukkan catatan jika ada selisih atau informasi lain..."
                    />
                  </div>

                  <div className="pt-6 flex space-x-4">
                    <button 
                      onClick={() => setStep('INPUT')} 
                      className="flex-1 py-5 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-3xl transition-all"
                    >
                      Edit Input
                    </button>
                    <button 
                      onClick={handleSettle}
                      disabled={isSubmitting}
                      className="flex-[2] py-5 bg-brand-500 hover:bg-brand-400 text-white font-black rounded-3xl transition-all shadow-2xl shadow-brand-500/30 flex items-center justify-center space-x-3 group"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : (
                        <>
                          <Printer className="w-7 h-7 group-hover:scale-110 transition-transform" />
                          <span className="text-xl">Tutup Shift & Print</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const StepBadge: React.FC<{ active: boolean, label: string }> = ({ active, label }) => (
  <span className={cn(
    "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all",
    active ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20" : "bg-neutral-900 text-neutral-600"
  )}>
    {label}
  </span>
);
