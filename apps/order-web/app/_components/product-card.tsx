'use client';

import { PackageIcon } from 'lucide-react';
import { formatRupiah } from '@petshop/shared';
import { CatalogProductSummary, STOCK_BADGE_CLASS, STOCK_LABEL } from './types';

export function ProductCard({ product, onSelect }: { product: CatalogProductSummary; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition active:scale-[0.98]"
    >
      <div className="relative flex aspect-square items-center justify-center bg-secondary">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <PackageIcon className="h-10 w-10 text-muted-foreground" />
        )}
        <span
          className={`absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${STOCK_BADGE_CLASS[product.stockStatus]}`}
        >
          {STOCK_LABEL[product.stockStatus]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
        <p className="mt-auto text-sm font-semibold text-primary">
          {formatRupiah(product.basePrice)}
          <span className="text-xs font-normal text-muted-foreground"> / {product.baseUomCode}</span>
        </p>
      </div>
    </button>
  );
}
