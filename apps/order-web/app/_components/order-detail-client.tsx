'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatRupiah } from '@petshop/shared';
import { OrderDetail, ORDER_STATUS_LABEL, ORDER_STATUS_BADGE_CLASS } from './types';

export function OrderDetailClient({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orders/${orderId}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        setOrder(await res.json());
      })
      .catch(() => setNotFound(true));
  }, [orderId]);

  async function handleReorder() {
    setReordering(true);
    setReorderMsg(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setReorderMsg(data.error ?? 'Gagal memuat ulang pesanan');
        return;
      }
      router.push('/keranjang');
    } catch {
      setReorderMsg('Terjadi kesalahan, coba lagi');
    } finally {
      setReordering(false);
    }
  }

  if (notFound) {
    return <div className="p-4 text-sm text-muted-foreground">Pesanan tidak ditemukan.</div>;
  }

  if (!order) {
    return <div className="p-4 text-sm text-muted-foreground">Memuat detail pesanan...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{order.orderNumber}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE_CLASS[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>

      {order.status === 'REJECTED' && order.rejectReason && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-destructive">{order.rejectReason}</p>
      )}

      <div className="rounded-md border border-border bg-card p-3">
        <p className="mb-2 text-sm font-medium text-foreground">Item Pesanan</p>
        <div className="flex flex-col gap-2">
          {order.items.map((item, idx) => (
            <div key={`${item.productId}-${idx}`} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.productName} x{item.qty} {item.uomCode}
              </span>
              <span className="font-medium text-foreground">{formatRupiah(item.subtotalSnapshot)}</span>
            </div>
          ))}
        </div>
      </div>

      {order.note && (
        <div className="rounded-md border border-border bg-card p-3">
          <p className="mb-1 text-sm font-medium text-foreground">Catatan</p>
          <p className="text-sm text-muted-foreground">{order.note}</p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border border-border bg-card p-3">
        <span className="text-sm text-muted-foreground">Total estimasi</span>
        <span className="text-lg font-semibold text-foreground">{formatRupiah(order.estimatedTotal)}</span>
      </div>

      {order.status === 'CONFIRMED' && order.finalTotal != null && order.finalTotal !== order.estimatedTotal && (
        <div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2">
          <span className="text-sm text-green-800">Total final (disesuaikan admin)</span>
          <span className="text-sm font-semibold text-green-800">{formatRupiah(order.finalTotal)}</span>
        </div>
      )}

      {reorderMsg && <p className="text-sm text-destructive">{reorderMsg}</p>}

      <button
        onClick={handleReorder}
        disabled={reordering}
        className="rounded-md border border-primary px-4 py-3 text-center font-medium text-primary disabled:opacity-50"
      >
        {reordering ? 'Memproses...' : 'Pesan Lagi'}
      </button>

      <Link href="/pesanan" className="text-center text-sm text-muted-foreground underline">
        Kembali ke Riwayat Pesanan
      </Link>
    </div>
  );
}
