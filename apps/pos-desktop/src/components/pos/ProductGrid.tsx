import React from 'react';
import { useCartStore } from '@/store/cart-store';
import { usePOSStore } from '@/store/pos-store';
import { formatRupiah } from '@/lib/utils';
import { Plus, Package, Weight } from 'lucide-react';

interface ProductGridProps {
  products: any[];
  isLoading: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, isLoading }) => {
  const addItem = useCartStore((state) => state.addItem);
  const { prices, uoms } = usePOSStore();

  const getRetailPrice = (productId: number, baseUomId: number): number => {
    const found = prices.find(
      (p: any) => p.productId === productId && p.uomId === baseUomId && p.tierType === 'RETAIL'
    );
    return found ? parseFloat(found.price) : 0;
  };

  const getBaseUomCode = (baseUomId: number): string => {
    const uom = uoms.find((u: any) => u.id === baseUomId);
    return uom?.code ?? 'PCS';
  };

  const handleAddProduct = (product: any) => {
    const uomCode = getBaseUomCode(product.baseUomId);
    const unitPrice = getRetailPrice(product.id, product.baseUomId);

    addItem({
      productId: product.id,
      productName: product.name,
      uomId: product.baseUomId,
      uomCode,
      qty: 1,
      unitPrice,
      priceTier: 'RETAIL',
      discountAmount: 0,
      subtotal: unitPrice,
      isOwnerOverride: false,
      weightGram: product.weightGram ?? null,
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-full overflow-hidden bg-[#0d0d0d] rounded-2xl border border-white/5">
        <table className="w-full text-left">
          <thead className="bg-[#161616] border-b border-white/5">
            <tr>
              <th className="py-3 px-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Produk</th>
              <th className="py-3 px-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Stok</th>
              <th className="py-3 px-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Harga</th>
              <th className="py-3 px-4 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="py-3 px-4 space-y-2">
                  <div className="h-4 bg-neutral-800 rounded w-1/2 animate-pulse" />
                  <div className="h-3 bg-neutral-800 rounded w-1/4 animate-pulse" />
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="h-4 bg-neutral-800 rounded w-12 ml-auto animate-pulse" />
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="h-4 bg-neutral-800 rounded w-20 ml-auto animate-pulse" />
                </td>
                <td className="py-3 px-4">
                  <div className="w-8 h-8 bg-neutral-800 rounded-xl mb-auto animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-500 h-full border border-dashed border-white/10 rounded-2xl">
        <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
          <span className="text-4xl">🔍</span>
        </div>
        <p className="text-lg font-medium text-white mb-1">Produk tidak ditemukan</p>
        <p className="text-sm">Coba cari dengan nama atau barcode lain</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar bg-[#0d0d0d] rounded-2xl border border-white/5">
      <table className="w-full text-left whitespace-nowrap">
        <thead className="bg-[#161616] border-b border-white/5 sticky top-0 z-10">
          <tr>
            <th className="py-4 px-5 text-xs font-bold text-neutral-500 uppercase tracking-widest w-full">Produk & SKU</th>
            <th className="py-4 px-5 text-xs font-bold text-neutral-500 uppercase tracking-widest text-right">Stok</th>
            <th className="py-4 px-5 text-xs font-bold text-neutral-500 uppercase tracking-widest text-right">Harga (Eceran)</th>
            <th className="py-4 px-5 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {products.map((product) => {
            const retailPrice = getRetailPrice(product.id, product.baseUomId);
            const baseUomCode = getBaseUomCode(product.baseUomId);

            return (
              <tr 
                key={product.id}
                onClick={() => handleAddProduct(product)}
                className="group hover:bg-[#161616] cursor-pointer transition-colors"
              >
                <td className="py-3 px-5">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-neutral-500 group-hover:text-brand-400 group-hover:bg-brand-500/10 transition-colors flex-shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-neutral-100 group-hover:text-brand-400 transition-colors truncate">
                        {product.name}
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                        {product.sku || 'N/A'}
                        {product.weightGram && (
                          <span className="ml-2 inline-flex items-center text-[10px] text-brand-500/80 font-medium bg-brand-500/5 px-1.5 py-0.5 rounded-md border border-brand-500/10">
                            <Weight className="w-2.5 h-2.5 mr-1" />
                            {parseFloat(product.weightGram) >= 1000 
                              ? `${(parseFloat(product.weightGram) / 1000).toFixed(2)}kg` 
                              : `${parseFloat(product.weightGram)}g`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-5 text-right">
                  <div className="text-sm font-bold text-neutral-300">
                    {product.stock ? parseFloat(product.stock) : 0} <span className="text-xs text-neutral-600 font-normal">{baseUomCode}</span>
                  </div>
                </td>
                <td className="py-3 px-5 text-right">
                  <div className="text-sm font-black text-brand-400 font-mono">
                    {formatRupiah(retailPrice)}
                  </div>
                </td>
                <td className="py-3 px-5 text-right">
                  <button className="w-8 h-8 rounded-lg bg-neutral-800 group-hover:bg-brand-500 text-neutral-400 group-hover:text-neutral-950 flex items-center justify-center transition-all ml-auto">
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
