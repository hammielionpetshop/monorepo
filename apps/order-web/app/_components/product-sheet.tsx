'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus, X, PackageIcon } from 'lucide-react';
import { formatRupiah } from '@petshop/shared';
import { CatalogProductDetail, STOCK_BADGE_CLASS, STOCK_LABEL } from './types';
import { useCart } from './cart-context';

export function ProductSheet({ productId, onClose }: { productId: number; onClose: () => void }) {
  const { addItem } = useCart();
  const [detail, setDetail] = useState<CatalogProductDetail | null>(null);
  const [selectedUomId, setSelectedUomId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/catalog/${productId}`)
      .then((res) => res.json())
      .then((data: CatalogProductDetail) => {
        if (cancelled) return;
        setDetail(data);
        setSelectedUomId(data.uoms[0]?.uomId ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const selectedUom = detail?.uoms.find((u) => u.uomId === selectedUomId);

  async function handleAdd() {
    if (!selectedUomId) return;
    setSubmitting(true);
    setError(null);
    const result = await addItem(productId, selectedUomId, qty);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menambah item');
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-card p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <h2 className="pr-4 text-base font-semibold text-foreground">{detail?.name ?? 'Memuat...'}</h2>
          <button onClick={onClose} aria-label="Tutup" className="rounded-md p-1 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!detail ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Memuat produk...</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-secondary">
                {detail.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.imageUrl} alt={detail.name} className="h-full w-full object-cover" />
                ) : (
                  <PackageIcon className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-primary">
                  {selectedUom ? formatRupiah(selectedUom.price) : '-'}
                </p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_BADGE_CLASS[detail.stockStatus]}`}>
                  {STOCK_LABEL[detail.stockStatus]}
                </span>
              </div>
            </div>

            {detail.uoms.length > 1 && (
              <div>
                <p className="mb-1.5 text-sm text-muted-foreground">Pilih satuan</p>
                <div className="flex flex-wrap gap-2">
                  {detail.uoms.map((uom) => (
                    <button
                      key={uom.uomId}
                      onClick={() => setSelectedUomId(uom.uomId)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${
                        uom.uomId === selectedUomId
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground'
                      }`}
                    >
                      {uom.uomCode}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Jumlah</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="rounded-md border border-border p-1.5"
                  aria-label="Kurangi"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={qty}
                  min={1}
                  max={9999}
                  onChange={(e) => setQty(Math.min(9999, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-14 rounded-md border border-border bg-card px-2 py-1.5 text-center"
                />
                <button
                  onClick={() => setQty((q) => Math.min(9999, q + 1))}
                  className="rounded-md border border-border p-1.5"
                  aria-label="Tambah"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              onClick={handleAdd}
              disabled={submitting || !selectedUomId}
              className="rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
            >
              {submitting ? 'Menambahkan...' : 'Tambah ke Keranjang'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
