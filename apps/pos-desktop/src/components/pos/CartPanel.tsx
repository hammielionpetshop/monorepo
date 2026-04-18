import React, { useState } from 'react';
import { ShoppingCart, Trash2, UserPlus, CreditCard, Clock, Pause, Weight } from 'lucide-react';
import { useCartStore } from '@/store/cart-store';
import { usePOSStore } from '@/store/pos-store';
import { CartItem } from './CartItem';
import { PaymentDialog } from './PaymentDialog';
import { apiClient } from '@/lib/api-client';
import { formatRupiah } from '@/lib/utils';
import { toast } from 'sonner';
import { PromptDialog } from '../ui/PromptDialog';

export const CartPanel: React.FC = () => {
  const { items, clearCart, getTotals, customerId } = useCartStore();
  const { setShowOpenBillsDrawer } = usePOSStore();
  const totals = getTotals();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [showHoldPrompt, setShowHoldPrompt] = useState(false);

  const handleHold = (name: string) => {
    if (items.length === 0) return;
    performHold(name);
  };

  const performHold = async (name: string) => {
    try {
      setIsHolding(true);
      await apiClient('/pos/open-bills', {
        method: 'POST',
        body: JSON.stringify({
          branchId: 1,
          holdName: name || `Bill ${new Date().toLocaleTimeString()}`,
          items: items,
          customerId: customerId
        })
      });
      clearCart();
      toast.success('Transaksi berhasil ditahan');
    } catch (err) {
      console.error('Failed to hold bill:', err);
      toast.error('Gagal menahan transaksi');
    } finally {
      setIsHolding(false);
    }
  };

  return (
    <div className="w-[420px] bg-[#0d0d0d] border-l border-white/5 flex flex-col shadow-2xl relative z-10">
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-brand-400" />
            <h2 className="font-bold text-lg text-white">Keranjang</h2>
            <button
              onClick={() => setShowOpenBillsDrawer(true)}
              className="ml-2 p-1.5 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-brand-400 transition-all border border-white/5"
              title="Daftar Tunggu (Resume)"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={clearCart}
            className="text-xs font-bold text-neutral-600 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center space-x-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Kosongkan</span>
          </button>
        </div>

        <button className="w-full flex items-center justify-between px-4 py-3 bg-[#161616] border border-white/5 rounded-2xl group hover:border-brand-500/30 transition-all text-left">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-brand-400 group-hover:bg-brand-500/10 transition-colors">
              <UserPlus className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-neutral-100 group-hover:text-brand-400 transition-colors">Pilih Pelanggan</span>
              <span className="text-[10px] text-neutral-500 font-medium">Umum / Guest</span>
            </div>
          </div>
        </button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-4">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-4">
            <ShoppingCart className="w-12 h-12 opacity-10" />
            <p className="text-sm font-medium">Keranjang kosong</p>
          </div>
        ) : (
          items.map((item) => (
            <CartItem key={item.productId} item={item} />
          ))
        )}
      </div>

      {/* Summary & Actions */}
      <div className="p-6 bg-[#111] border-t border-white/5">
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-500 font-medium">Subtotal ({totals.itemCount} item)</span>
              <span className="text-neutral-300 font-mono">{formatRupiah(totals.subtotal)}</span>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 font-medium">Diskon</span>
                <span className="text-red-400 font-mono">- {formatRupiah(totals.discountTotal)}</span>
              </div>
            )}
            {totals.totalWeightGram > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500 font-medium flex items-center gap-1">
                  <Weight className="w-3.5 h-3.5" />
                  Total Berat
                </span>
                <span className="text-neutral-400 font-mono">
                  {totals.totalWeightGram >= 1000
                    ? `${(totals.totalWeightGram / 1000).toFixed(2)} kg`
                    : `${totals.totalWeightGram.toFixed(0)} g`}
                </span>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-white/5 flex justify-between items-end">
            <span className="text-neutral-100 font-bold uppercase tracking-wider">Grand Total</span>
            <span className="text-2xl font-black text-brand-400 font-mono tracking-tight leading-none">
              {formatRupiah(totals.grandTotal)}
            </span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setShowHoldPrompt(true)}
            disabled={items.length === 0 || isHolding}
            className="flex-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 text-neutral-400 font-bold py-5 rounded-2xl border border-white/10 transition-all flex items-center justify-center space-x-2"
          >
            {isHolding ? (
              <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Pause className="w-4 h-4" />
                <span className="uppercase tracking-tight text-xs">Tahan</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsPaymentOpen(true)}
            disabled={items.length === 0}
            className="flex-[2] bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-5 rounded-2xl shadow-xl shadow-brand-500/10 transition-all flex items-center justify-center space-x-3 active:scale-[0.98]"
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-lg uppercase tracking-tight">Bayar</span>
          </button>
        </div>
      </div>

      <PaymentDialog isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} />

      <PromptDialog
        isOpen={showHoldPrompt}
        onClose={() => setShowHoldPrompt(false)}
        onConfirm={handleHold}
        title="Tahan Transaksi"
        message="Masukkan nama atau keterangan antrean (misal: Nomor Meja atau Nama Pelanggan)."
        placeholder="Contoh: Meja 12"
      />
    </div>
  );
};
