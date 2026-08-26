'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface POItem {
  id: number;
  productId: number;
  productName: string | null;
  productSku: string | null;
  uomId: number;
  uomCode: string | null;
  qtyOrdered: number;
  qtyReceived: number;
  qtyDamaged: number;
}

interface PO {
  id: number;
  poNumber: string;
  status: string;
  totalAmount: number;
  supplier: { id: number | null; name: string; phone: string | null };
  branch: { id: number; name: string };
  items: POItem[];
}

interface ReceivingItemState {
  poItemId: number;
  qtyReceived: string;
  qtyDamaged: string;
  expiryDate: string;
}

export function ReceivePOClient({ po }: { po: PO }) {
  const router = useRouter();
  const [receivingItems, setReceivingItems] = useState<ReceivingItemState[]>(
    po.items.map(item => {
      const remaining = item.qtyOrdered - item.qtyReceived;
      return {
        poItemId: item.id,
        qtyReceived: remaining > 0 ? String(remaining) : '0',
        qtyDamaged: '0',
        expiryDate: '',
      };
    }),
  );
  const [invoiceReceived, setInvoiceReceived] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleItemChange = (index: number, field: keyof ReceivingItemState, value: string) => {
    setReceivingItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async () => {
    setError('');

    for (let i = 0; i < receivingItems.length; i++) {
      const ri = receivingItems[i];
      const item = po.items[i];
      const qty = parseInt(ri.qtyReceived, 10);
      const dmg = parseInt(ri.qtyDamaged, 10);
      if (Number.isNaN(qty) || qty < 0) {
        setError(`Qty terima untuk ${item.productName} tidak valid`);
        return;
      }
      if (Number.isNaN(dmg) || dmg < 0) {
        setError(`Qty rusak untuk ${item.productName} tidak valid`);
        return;
      }
      if (dmg > qty) {
        setError(`Qty rusak tidak boleh melebihi qty terima untuk ${item.productName}`);
        return;
      }
    }

    const hasAnyReceived = receivingItems.some(ri => parseInt(ri.qtyReceived, 10) > 0);
    if (!hasAnyReceived) {
      setError('Masukkan qty yang diterima minimal untuk satu item');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/bo/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceReceived,
          note: note.trim() || null,
          items: receivingItems.map(ri => ({
            poItemId: ri.poItemId,
            qtyReceived: Math.round(parseFloat(ri.qtyReceived) || 0),
            qtyDamaged: Math.round(parseFloat(ri.qtyDamaged) || 0),
            expiryDate: ri.expiryDate || null,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan penerimaan');
        return;
      }

      router.push(`/purchase-orders/${po.id}`);
      router.refresh();
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href={`/purchase-orders/${po.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke detail PO
      </Link>

      <div>
        <h1 className="text-xl font-semibold font-mono">{po.poNumber}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {po.supplier.name} · {po.branch.name}
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-medium text-foreground text-sm">Catat Penerimaan Barang</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Produk</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-16">Pesan</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-16">Sisa</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-24">Diterima</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-24">Rusak</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground w-32">Exp. Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {po.items.map((item, i) => {
              const remaining = item.qtyOrdered - item.qtyReceived;
              const ri = receivingItems[i];
              return (
                <tr key={item.id} className={remaining <= 0 ? 'opacity-50' : ''}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground text-xs">{item.productName ?? '-'}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.productSku ?? '-'} · {item.uomCode}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">{item.qtyOrdered}</td>
                  <td className="px-2 py-2.5 text-center text-xs font-medium text-foreground">{remaining}</td>
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ri ? (parseInt(ri.qtyReceived, 10) || 0).toLocaleString('id-ID') : '0'}
                      onChange={e => handleItemChange(i, 'qtyReceived', e.target.value.replace(/\D/g, '') || '0')}
                      disabled={remaining <= 0 || isSubmitting}
                      className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ri ? (parseInt(ri.qtyDamaged, 10) || 0).toLocaleString('id-ID') : '0'}
                      onChange={e => handleItemChange(i, 'qtyDamaged', e.target.value.replace(/\D/g, '') || '0')}
                      disabled={remaining <= 0 || isSubmitting}
                      className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="date"
                      value={ri?.expiryDate ?? ''}
                      onChange={e => handleItemChange(i, 'expiryDate', e.target.value)}
                      disabled={remaining <= 0 || isSubmitting}
                      className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={invoiceReceived}
            onChange={e => setInvoiceReceived(e.target.checked)}
            disabled={isSubmitting}
            className="w-4 h-4 rounded border-border"
          />
          <span className="text-sm text-foreground">Invoice/surat jalan diterima</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Catatan (opsional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            placeholder="Catatan kondisi barang, dll."
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
          />
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Link
          href={`/purchase-orders/${po.id}`}
          className="px-4 py-2 text-sm border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Batal
        </Link>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan...' : 'Simpan Penerimaan'}
        </button>
      </div>
    </div>
  );
}
