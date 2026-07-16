'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { CatalogFilterOption, CatalogListResponse, CatalogProductSummary } from './types';
import { ProductCard } from './product-card';
import { ProductSheet } from './product-sheet';

export function CatalogClient() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [categories, setCategories] = useState<CatalogFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (categoryId) params.set('categoryId', String(categoryId));

    fetch(`/api/catalog?${params.toString()}`)
      .then((res) => res.json())
      .then((data: CatalogListResponse) => {
        setProducts(data.products);
        if (data.filters) setCategories(data.filters.categories);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, categoryId]);

  return (
    <div className="flex flex-col gap-3 p-4 pb-8">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-card py-2.5 pl-9 pr-3 text-sm"
        />
      </div>

      {categories.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            onClick={() => setCategoryId(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              categoryId === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Produk tidak ditemukan, coba kata kunci lain.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onSelect={() => setSelectedProductId(product.id)} />
          ))}
        </div>
      )}

      {selectedProductId && (
        <ProductSheet productId={selectedProductId} onClose={() => setSelectedProductId(null)} />
      )}
    </div>
  );
}
