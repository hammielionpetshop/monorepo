import { Trash2, ShieldAlert } from 'lucide-react';
import { CartItem as CartItemType } from '@petshop/shared';
import { UomSelector } from './UomSelector';
import { TierPriceSelector } from './TierPriceSelector';
import { usePOSStore } from '@/store/pos-store';
import { useCartStore } from '@/store/cart-store';
import { getPriceKey } from '@petshop/shared';
import { formatRupiah } from '@/lib/utils';

interface CartItemProps {
  item: CartItemType;
}

export const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateQty, removeItem, updateItem, replaceItem } = useCartStore();
  const { prices, setOverrideItem, setShowPinChallenge, products, conversions, setPendingAction } = usePOSStore();

  const handleQtyChange = (newQty: number) => {
    if (newQty < 1) {
      removeItem(item.productId);
      return;
    }

    // Jika qty berkurang, selalu izinkan tanpa PIN
    if (newQty <= item.qty) {
      updateQty(item.productId, newQty);
      return;
    }

    // Qty bertambah - perlu validasi stok
    const product = products.find((p: any) => p.id === item.productId);
    if (!product) return;

    let ratio = 1;
    if (item.uomId !== product.baseUomId) {
      const conv = conversions.find((c: any) => c.productId === item.productId && c.uomId === item.uomId);
      ratio = conv ? parseFloat(conv.ratio) : 1;
    }

    const requestedBaseQty = newQty * ratio;
    const availableStock = parseFloat(product.stock || '0');

    if (requestedBaseQty > availableStock) {
      setPendingAction({
        type: 'STOCK_OVERRIDE',
        productId: item.productId,
        uomId: item.uomId,
        data: { targetQty: newQty }
      });
      setShowPinChallenge(true);
    } else {
      updateQty(item.productId, newQty);
    }
  };

  const handleUomChange = (uomId: number, uomCode: string) => {
    const branchId = 1;
    const foundPrice = prices.find((p: any) =>
      p.productId === item.productId &&
      p.branchId === branchId &&
      p.uomId === uomId &&
      p.tierType === item.priceTier
    );

    const newPrice = foundPrice ? parseFloat(foundPrice.price) : 0;

    const product = products.find((p: any) => p.id === item.productId);
    let newWeightGram: number | null = null;
    if (uomId === product?.baseUomId) {
      newWeightGram = product?.weightGram ?? null;
    } else {
      const conv = conversions.find((c: any) =>
        c.productId === item.productId && c.uomId === uomId
      );
      newWeightGram = conv?.weightGram ?? null;
    }

    replaceItem(item.productId, {
      ...item,
      uomId,
      uomCode,
      unitPrice: newPrice,
      subtotal: (newPrice * item.qty) - item.discountAmount,
      weightGram: newWeightGram,
    });
  };

  const handleTierChange = (tier: any) => {
    const branchId = 1;
    const foundPrice = prices.find((p: any) =>
      p.productId === item.productId &&
      p.branchId === branchId &&
      p.uomId === item.uomId &&
      p.tierType === tier
    );

    const newPrice = foundPrice ? parseFloat(foundPrice.price) : 0;

    updateItem(item.productId, {
      priceTier: tier,
      unitPrice: newPrice
    });
  };

  return (
    <div className="group relative bg-[#111]/40 p-4 rounded-2xl border border-white/5 hover:border-brand-500/20 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-bold text-neutral-200 truncate group-hover:text-brand-400 transition-colors">
              {item.productName}
            </h4>
            <button
              onClick={() => {
                setOverrideItem({ productId: item.productId, uomId: item.uomId });
                setShowPinChallenge(true);
              }}
              className="p-1 text-neutral-600 hover:text-brand-400 transition-colors"
              title="Owner Price Override"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2">
            <UomSelector
              productId={item.productId}
              currentUomId={item.uomId}
              onSelect={handleUomChange}
            />
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-sm font-black text-white font-mono italic">
            {formatRupiah(item.subtotal)}
          </span>
          <span className="text-[10px] text-neutral-500 font-mono mt-1">@ {formatRupiah(item.unitPrice).replace('Rp ', '')}</span>
        </div>
      </div>

      <div className="mb-3">
        <TierPriceSelector
          currentTier={item.priceTier}
          onSelect={handleTierChange}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center bg-[#161616] rounded-xl border border-white/5 overflow-hidden">
          <button
            onClick={() => handleQtyChange(item.qty - 1)}
            className="px-3 py-1.5 hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
          >
            -
          </button>
          <span className="w-10 text-center text-xs font-bold font-mono border-x border-white/5">
            {item.qty}
          </span>
          <button
            onClick={() => handleQtyChange(item.qty + 1)}
            className="px-3 py-1.5 hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
          >
            +
          </button>
        </div>
        <button
          onClick={() => removeItem(item.productId)}
          className="p-2 text-neutral-700 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
