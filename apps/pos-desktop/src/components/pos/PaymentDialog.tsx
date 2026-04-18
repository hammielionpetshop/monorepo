import { X, CreditCard, CheckCircle2, Trash2, Plus } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { usePOSStore } from '@/store/pos-store';
import { cn, formatRupiah } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { printService } from '@/lib/print-service';
import { NumberInput } from '@/components/ui/NumberInput';
import { useEffect, useState } from 'react';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({ isOpen, onClose }) => {
  const { getTotals, clearCart, items } = useCartStore();
  const { paymentMethods } = usePOSStore();
  const totals = getTotals();
  
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [payments, setPayments] = useState<{ paymentMethodId: number, name: string, amount: number }[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state every time dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMethod(null);
      setAmountInput('');
      setPayments([]);
      setIsSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  const amountPaidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, totals.grandTotal - amountPaidTotal);
  const change = Math.max(0, amountPaidTotal - totals.grandTotal);

  const handleAddPayment = () => {
    if (!selectedMethod || !amountInput) return;
    
    const method = paymentMethods.find(m => m.id === selectedMethod);
    if (!method) return;

    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) return;

    setPayments([...payments, { 
      paymentMethodId: selectedMethod, 
      name: method.name, 
      amount 
    }]);
    
    setAmountInput('');
    setSelectedMethod(null);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handlePayment = async () => {
    if (amountPaidTotal < totals.grandTotal) return;

    try {
      setIsSubmitting(true);
      setIsSuccess(false);
      
      const branchId = 1; 
      const shiftId = 1;
      
      const payload = {
        branchId,
        shiftId,
        customerId: useCartStore.getState().customerId || null,
        items: items,
        totals: totals,
        amountPaid: amountPaidTotal,
        change: change,
        payments: payments.map(p => ({
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
          referenceNumber: null
        }))
      };

      const response = await apiClient('/pos/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Try printing
      try {
        await printService.printReceipt({
          trxNumber: response.transaction.trxNumber,
          items: items,
          totals: totals,
          payments: payments
        });
      } catch (printErr) {
        console.warn('Printing failed:', printErr);
        // Don't block the UI if only printing fails
      }

      setIsSuccess(true);
      setTimeout(() => {
        clearCart();
        handleClose();
        setIsSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error('Payment failed:', err);
      alert('Gagal memproses pembayaran: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="bg-[#111] border border-white/5 rounded-3xl p-12 text-center max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Transaksi Berhasil!</h2>
          <p className="text-neutral-500 mb-8">Struk sedang dicetak...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <h2 className="text-xl font-bold text-white">Pembayaran Multi-Metode</h2>
          <button onClick={handleClose} className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[500px]">
          {/* Left: Payment Input */}
          <div className="flex-1 p-6 border-r border-white/5 overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">1. Pilih Metode</label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {paymentMethods.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMethod(m.id)}
                      className={cn(
                        "flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all space-y-1.5",
                        selectedMethod === m.id 
                          ? "bg-brand-500/10 border-brand-500 text-brand-400" 
                          : "bg-[#161616] border-white/5 text-neutral-500 hover:border-white/10"
                      )}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span className="text-[11px] font-bold truncate w-full text-center px-1">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">2. Nominal</label>
                <div className="flex space-x-3 mt-2">
                  <div className="relative flex-1 group">
                    <NumberInput
                      value={amountInput}
                      onChange={(val) => setAmountInput(val)}
                      placeholder={remaining.toString()}
                      prefix="Rp"
                    />
                  </div>
                  <button
                    onClick={handleAddPayment}
                    disabled={!selectedMethod || !amountInput}
                    className="px-6 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-20 text-white font-bold rounded-xl transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Added Payments List */}
              <div className="space-y-2 pt-4">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Daftar Pembayaran</label>
                {payments.length === 0 ? (
                  <div className="text-center py-8 bg-[#111] border border-dashed border-white/5 rounded-2xl text-neutral-600 text-xs italic">
                    Belum ada pembayaran ditambahkan
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group animate-in slide-in-from-left-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-neutral-500">
                             <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[11px] font-bold text-neutral-200">{p.name}</div>
                            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-tight">TEREKAM</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-bold text-white font-mono">{formatRupiah(p.amount)}</span>
                          <button 
                            onClick={() => handleRemovePayment(i)}
                            className="p-1.5 text-neutral-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="w-80 bg-[#111] p-6 flex flex-col">
            <div className="space-y-6 flex-1">
              <div>
                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest leading-none">Total Tagihan</span>
                <div className="text-2xl font-black text-white font-mono tracking-tight mt-1">
                  {formatRupiah(totals.grandTotal)}
                </div>
              </div>
              
              <div className="pt-4 border-t border-white/5">
                <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest leading-none">Terbayar</span>
                <div className="text-xl font-bold text-brand-400 font-mono tracking-tight mt-1">
                  {formatRupiah(amountPaidTotal)}
                </div>
              </div>

              {remaining > 0 ? (
                <div className="pt-4 border-t border-white/5">
                  <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest leading-none">Sisa Kekurangan</span>
                  <div className="text-xl font-bold text-red-500 font-mono tracking-tight mt-1">
                    {formatRupiah(remaining)}
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-white/5">
                  <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest leading-none text-emerald-500/50">Kembalian</span>
                  <div className="text-xl font-bold text-emerald-500 font-mono tracking-tight mt-1">
                    {formatRupiah(change)}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handlePayment}
              disabled={amountPaidTotal < totals.grandTotal || isSubmitting}
              className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl shadow-xl shadow-brand-500/20 transition-all flex items-center justify-center space-x-2 mt-8"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Selesaikan</span>
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
