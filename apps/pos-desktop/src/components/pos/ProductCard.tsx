import React from 'react';
import { Package, Hash, Tag, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: any;
  retailPrice: number;
  baseUomCode: string;
  onAdd: (product: any) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, retailPrice, baseUomCode, onAdd }) => {
  return (
    <div 
      onClick={() => onAdd(product)}
      className="bg-[#111] border border-white/5 rounded-2xl p-4 hover:border-brand-500/30 hover:bg-[#161616] cursor-pointer transition-all group flex flex-col h-full active:scale-[0.98]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-brand-400 group-hover:bg-brand-500/10 transition-colors">
          <Package className="w-6 h-6" />
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest leading-none mb-1">SKU</span>
          <span className="text-xs font-mono text-neutral-400 leading-none">{product.sku || 'N/A'}</span>
        </div>
      </div>

      <h3 className="text-sm font-bold text-neutral-100 mb-2 line-clamp-2 min-h-[2.5rem]">
        {product.name}
      </h3>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center text-neutral-500">
            <Hash className="w-3 h-3 mr-1" />
            <span>Stok: <span className="text-neutral-300 font-bold">{product.stock || 0} {baseUomCode}</span></span>
          </div>
          <div className="flex items-center text-brand-400 font-bold">
            <Tag className="w-3 h-3 mr-1" />
            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(retailPrice)}</span>
          </div>
        </div>

        <button className="w-full py-2 bg-neutral-800 group-hover:bg-brand-500 text-neutral-400 group-hover:text-neutral-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1">
          <Plus className="w-3 h-3" />
          <span>Tambah</span>
        </button>
      </div>
    </div>
  );
};
