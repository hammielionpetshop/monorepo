import { X, CreditCard, CheckCircle2, Trash2, Plus } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { usePOSStore } from '@/store/pos-store';
import { useShiftStore } from '@/store/shift-store';
import { cn, formatRupiah } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { printService } from '@/lib/print-service';
import { NumberInput } from '@/components/ui/NumberInput';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import { useNetworkStore } from '@/store/network-store';
import { offlineQueueService } from '@/services/offline-queue-service';
import { localStockService } from '@/services/local-stock-service';
import { OversellWarningModal, type OversellItem } from './OversellWarningModal';
import Big from 'big.js';
import { getDb } from '@/lib/db';
import type { CartItem } from '@petshop/shared';
import { DeliveryOrderDialog } from './DeliveryOrderDialog';

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
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [showDODialog, setShowDODialog] = useState(false);
  const [oversellItems, setOversellItems] = useState<OversellItem[]>([]);
  const [showOversellModal, setShowOversellModal] = useState(false);

  // Reset state every time dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMethod(null);
      setAmountInput('');
      setPayments([]);
      setIsSuccess(false);
      setIsSubmitting(false);
      setOversellItems([]);
      setShowOversellModal(false);
    }
  }, [isOpen]);

  const checkStockConflicts = async (cartItems: CartItem[]): Promise<OversellItem[]> => {
    const db = await getDb();
    const conflicts: OversellItem[] = [];
    for (const item of cartItems) {
      const product = await db.products.get(item.productId);
      if (!product) continue;
      let ratio = new Big(1);
      if (item.uomId !== product.baseUomId) {
        const conv = await db.productUoms
          .where('productId').equals(item.productId)
          .filter((c: any) => c.uomId === item.uomId)
          .first();
        if (conv?.ratio) ratio = new Big(conv.ratio);
      }
      const qtyInBase = new Big(item.qty).times(ratio);
      const available = new Big(product.stock ?? '0');
      if (qtyInBase.gt(available)) {
        conflicts.push({
          productName: item.productName,
          requested: qtyInBase.toNumber(),
          available: Math.max(0, available.toNumber()),
        });
      }
    }
    return conflicts;
  };

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

  const checkAndPay = async () => {
    if (amountPaidTotal < totals.grandTotal) return;
    const conflicts = await checkStockConflicts(items);
    if (conflicts.length > 0) {
      setOversellItems(conflicts);
      setShowOversellModal(true);
      return;
    }
    await submitPayment(false);
  };

  const submitPayment = async (isOversell: boolean) => {
    try {
      setIsSubmitting(true);
      setIsSuccess(false);

      const branchId = 1;
      const { activeShift, activeCashierId } = useShiftStore.getState();
      const { isOnline } = useNetworkStore.getState();
      const { user } = useAuthStore.getState();
      const { customerId } = useCartStore.getState();

      if (!activeShift) {
        toast.error('Shift tidak aktif! Silakan masuk melalui Shift Gate.');
        return;
      }

      const basePayload = {
        branchId,
        shiftId: activeShift.id,
        cashierId: activeCashierId || user?.id || null,
        customerId: customerId || null,
        items: items,
        totals: totals,
        amountPaid: amountPaidTotal,
        change: change,
        payments: payments.map(p => ({
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
          referenceNumber: null
        })),
        ...(isOversell && {
          authorizedOversell: true,
          oversellApprovedAt: Date.now(),
        }),
      };

      let finalTrxNumber: string;

      if (!isOnline) {
        // Path Offline
        finalTrxNumber = await offlineQueueService.enqueue({ ...basePayload, offlineAt: Date.now() });
      } else {
        // Path Online
        const response = await apiClient('/pos/transactions', {
          method: 'POST',
          body: JSON.stringify(basePayload),
        });
        finalTrxNumber = response.transaction.trxNumber;
      }

      // Simpan ke localTransactions untuk history — KEDUANYA online & offline
      const customers = usePOSStore.getState().customers;
      const customer = basePayload.customerId ? customers.find(c => c.id === basePayload.customerId) : null;
      const customerName = customer ? customer.name : (basePayload.customerId ? `Customer #${basePayload.customerId}` : '');

      try {
        await offlineQueueService.saveLocalTransaction({
          shiftId: activeShift.id,
          trxNumber: finalTrxNumber,
          createdAt: Date.now(),
          customerName,
          totalAmount: new Big(totals.grandTotal).toString(),
          payload: { ...basePayload, trxNumber: finalTrxNumber },
        });

        const count = await offlineQueueService.getPendingCount();
        useNetworkStore.getState().setPendingCount(count);
      } catch (localErr) {
        console.warn('[PaymentDialog] Gagal menyimpan riwayat lokal atau update counter:', localErr);
      }

      // Try printing
      try {
        await printService.printReceipt({
          trxNumber: finalTrxNumber,
          items: items,
          totals: totals,
          payments: payments
        });
      } catch (printErr) {
        console.warn('[PaymentDialog] Pencetakan struk gagal:', printErr);
      }

      // Kurangi stok lokal — non-blocking
      localStockService.deductStock(items).catch((err) => {
        console.warn('[PaymentDialog] Gagal mengurangi stok lokal:', err);
      });

      setIsSuccess(true);
      setLastTransaction({
        id: finalTrxNumber, // Fallback ID
        trxNumber: finalTrxNumber,
        customer: customer ? { name: customer.name, address: '' } : null 
      });
      // Auto-clear cart but don't auto-close if we want DO prompt
      clearCart();
    } catch (err: any) {
      console.error('Payment failed:', err);
      toast.error('Gagal memproses pembayaran: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111] border border-white/5 rounded-3xl p-12 text-center max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Transaksi Berhasil!</h2>
            <p className="text-neutral-500 mb-8">Struk sedang dicetak...</p>
            
            <div className="space-y-3">
              <button 
                onClick={() => setShowDODialog(true)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all"
              >
                Cetak Surat Jalan
              </button>
              <button 
                onClick={handleClose}
                className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-bold rounded-xl transition-all"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>

        <DeliveryOrderDialog
          isOpen={showDODialog}
          onClose={() => {
            setShowDODialog(false);
            handleClose();
          }}
          transaction={lastTransaction}
        />
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
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
              onClick={checkAndPay}
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

      <OversellWarningModal
        isOpen={showOversellModal}
        items={oversellItems}
        onApprove={() => {
          setShowOversellModal(false);
          submitPayment(true);
        }}
        onCancel={() => {
          setShowOversellModal(false);
          setOversellItems([]);
        }}
      />
    </div>
  );
};
