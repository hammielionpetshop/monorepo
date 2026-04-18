import React from 'react';
import { ProductCard } from './ProductCard';
import { useCartStore } from '@/store/cart-store';
import { usePOSStore } from '@/store/pos-store';

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
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="bg-[#111] border border-white/5 rounded-2xl p-4 h-[200px] animate-pulse">
            <div className="w-12 h-12 rounded-xl bg-neutral-800 mb-4" />
            <div className="h-4 bg-neutral-800 rounded w-3/4 mb-2" />
            <div className="h-3 bg-neutral-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
        <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
          <span className="text-4xl">🔍</span>
        </div>
        <p className="text-lg font-medium">Produk tidak ditemukan</p>
        <p className="text-sm">Coba cari dengan nama atau barcode lain</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 h-full overflow-y-auto pr-2 custom-scrollbar">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          retailPrice={getRetailPrice(product.id, product.baseUomId)}
          baseUomCode={getBaseUomCode(product.baseUomId)}
          onAdd={handleAddProduct}
        />
      ))}
    </div>
  );
};
