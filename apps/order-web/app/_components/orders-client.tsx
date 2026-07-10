'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PackageSearch } from 'lucide-react';
import { formatRupiah } from '@petshop/shared';
import { OrderSummary, ORDER_STATUS_LABEL, ORDER_STATUS_BADGE_CLASS } from './types';

export function OrdersClient() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    fetch('/api/orders')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setOrders(data))
      .catch(() => setOrders([]));
  }, []);

  if (orders === null) {
    return <div className="p-4 text-sm text-muted-foreground">Memuat pesanan...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
        <PackageSearch className="h-12 w-12 text-muted-foreground" />
        <p className="font-medium text-foreground">Belum ada pesanan</p>
        <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Mulai belanja
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/pesanan/${order.id}`}
          className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{order.orderNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE_CLASS[order.status]}`}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{order.itemCount} item</span>
            <span className="font-medium text-foreground">{formatRupiah(order.estimatedTotal)}</span>
          </div>
          {order.status === 'REJECTED' && order.rejectReason && (
            <p className="text-xs text-destructive">{order.rejectReason}</p>
          )}
        </Link>
      ))}
    </div>
  );
}
