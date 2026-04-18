import React, { useState, useEffect } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { CartItem } from '@petshop/shared';
import { useCartStore } from '@/store/cart-store';

interface OwnerOverrideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: CartItem | null;
  retailPrice: number;
}

export const OwnerOverrideDialog: React.FC<OwnerOverrideDialogProps> = ({ isOpen, onClose, item, retailPrice }) => {
  const [overridePrice, setOverridePrice] = useState<string>('');
  const [warning, setWarning] = useState('');
  const { updateQty, removeItem, addItem } = useCartStore(); // Assuming addItem replaces if unique logic is handled or we manually swap

  useEffect(() => {
    if (isOpen && item) {
      setOverridePrice(item.unitPrice.toString());
      setWarning('');
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleApply = () => {
    const price = parseFloat(overridePrice);
    if (isNaN(price) || price <= 0) return;

    if (price < retailPrice * 0.5) {
      if (!window.confirm('WARNING: Harga override di bawah 50% dari harga Retail. Lanjutkan?')) {
        return;
      }
    }

    // Replace item in cart with override
    removeItem(item.productId, item.uomId);
    addItem({
      ...item,
      unitPrice: price,
      subtotal: (price * item.qty) - item.discountAmount,
      isOwnerOverride: true,
      priceTier: 'RETAIL' // override usually resets or ignores tier
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            Owner Override
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-3 rounded-xl text-xs font-medium">
            Anda sedang mengubah harga secara manual. Tindakan ini akan dicatat dalam Audit Log.
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Produk</label>
              <div className="text-sm font-bold text-white bg-[#111] p-3 rounded-xl border border-white/5 truncate">
                {item.productName}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Harga Baru (Rp)</label>
              <input 
                type="number"
                value={overridePrice}
                onChange={(e) => {
                  setOverridePrice(e.target.value);
                  const p = parseFloat(e.target.value);
                  if (p < retailPrice * 0.5) {
                    setWarning('Harga sangat rendah (< 50% Retail)');
                  } else {
                    setWarning('');
                  }
                }}
                className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 px-4 text-2xl font-black text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono"
                autoFocus
              />
              {warning && <p className="text-orange-500 text-xs mt-2 font-bold">{warning}</p>}
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={!overridePrice || parseFloat(overridePrice) <= 0}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl transition-all"
          >
            Terapkan Override
          </button>
        </div>
      </div>
    </div>
  );
};
