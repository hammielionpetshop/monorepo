import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePOSStore } from '@/store/pos-store';

interface ProductSearchProps {
  onSearch: (query: string, categoryId: number | null) => void;
}

export const ProductSearch: React.FC<ProductSearchProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const categories = usePOSStore((state) => state.categories);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      onSearch(query, selectedCat);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, selectedCat]);

  // F2 shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('product-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-brand-400 transition-colors" />
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama produk, SKU, atau scan barcode [F2]..."
          className="w-full bg-[#111] border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
          id="product-search-input"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-full text-neutral-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filter Tabs */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCat(null)}
            className={cn(
              "flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
              selectedCat === null
                ? "bg-brand-500 text-neutral-950 shadow-lg shadow-brand-500/20"
                : "bg-[#111] border border-white/5 text-neutral-500 hover:text-neutral-300"
            )}
          >
            Semua
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap",
                selectedCat === cat.id
                  ? "bg-brand-500 text-neutral-950 shadow-lg shadow-brand-500/20"
                  : "bg-[#111] border border-white/5 text-neutral-500 hover:text-neutral-300"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
