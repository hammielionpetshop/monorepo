'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, PackageIcon } from 'lucide-react';
import { formatRupiah } from '@petshop/shared';
import { useCart } from './cart-context';
import { CartItemView } from './types';

function CartRow({ item }: { item: CartItemView }) {
  const { setQty, removeItem } = useCart();
  const [busy, setBusy] = useState(false);

  async function changeQty(next: number) {
    setBusy(true);
    if (next <= 0) {
      await removeItem(item.id);
    } else {
      await setQty(item.id, next);
    }
    setBusy(false);
  }

  return (
    <div className="flex gap-3 border-b border-border py-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
        ) : (
          <PackageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{item.productName}</p>
        <p className="text-xs text-muted-foreground">
          {formatRupiah(item.unitPrice)} / {item.uomCode}
        </p>
        {!item.isActive && <p className="text-xs text-destructive">Produk sudah tidak aktif</p>}
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeQty(item.qty - 1)}
              disabled={busy}
              className="rounded-md border border-border p-1 disabled:opacity-50"
              aria-label="Kurangi"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center text-sm">{item.qty}</span>
            <button
              onClick={() => changeQty(item.qty + 1)}
              disabled={busy}
              className="rounded-md border border-border p-1 disabled:opacity-50"
              aria-label="Tambah"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => changeQty(0)}
              disabled={busy}
              className="ml-1 rounded-md p-1 text-destructive disabled:opacity-50"
              aria-label="Hapus"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-semibold text-foreground">{formatRupiah(item.subtotal)}</p>
        </div>
      </div>
    </div>
  );
}

export function CartClient() {
  const { cart, loading } = useCart();

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Memuat keranjang...</div>;
  }

  if (cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
        <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        <p className="font-medium text-foreground">Keranjang kosong</p>
        <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Mulai belanja
        </Link>
      </div>
    );
  }

  const remaining = cart.minOrderAmount - cart.subtotal;

  return (
    <div className="flex flex-col pb-40">
      <div className="px-4">
        {cart.items.map((item) => (
          <CartRow key={item.id} item={item} />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card p-4">
        {!cart.meetsMinimum && (
          <p className="mb-2 rounded-md bg-yellow-100 px-3 py-2 text-sm text-yellow-800">
            Tambah belanja {formatRupiah(remaining)} lagi untuk mencapai minimum order {formatRupiah(cart.minOrderAmount)}.
          </p>
        )}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total estimasi</span>
          <span className="text-lg font-semibold text-foreground">{formatRupiah(cart.subtotal)}</span>
        </div>
        {cart.meetsMinimum ? (
          <Link
            href="/checkout"
            className="block rounded-md bg-primary px-4 py-3 text-center font-medium text-primary-foreground"
          >
            Checkout
          </Link>
        ) : (
          <button disabled className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground opacity-50">
            Checkout
          </button>
        )}
      </div>
    </div>
  );
}
