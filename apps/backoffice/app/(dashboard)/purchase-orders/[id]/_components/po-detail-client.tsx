'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatWIB } from '@petshop/shared';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-purple-100 text-purple-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-orange-100 text-orange-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-600' },
  COMPLETED: { label: 'Selesai', color: 'bg-green-100 text-green-800' },
};

interface POItem {
  id: number;
  productName: string | null;
  productSku: string | null;
  uomCode: string | null;
  qtyOrdered: string;
  qtyReceived: string;
  qtyDamaged: string;
  unitCost: string;
  invoiceUnitCost: string | null;
}

interface PO {
  id: number;
  poNumber: string;
  status: string;
  totalAmount: string;
  notes: string | null;
  rejectionNote: string | null;
  invoiceNumber: string | null;
  targetDeliveryDate: string | null;
  approvedAt: string | null;
  createdAt: string;
  supplier: { id: number; name: string; phone: string | null };
  branch: { id: number; name: string };
  items: POItem[];
}

export function PODetailClient({
  po,
  currentUserId,
  role,
}: {
  po: PO;
  currentUserId: number;
  role: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const statusInfo = STATUS_LABELS[po.status] ?? { label: po.status, color: 'bg-gray-100 text-gray-600' };

  async function callAction(endpoint: string, body: object) {
    setLoading(endpoint);
    try {
      const res = await fetch(`/api/bo/purchase-orders/${po.id}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(null);
    }
  }

  const handleApprove = () =>
    callAction('approve', { approvedById: currentUserId, role });

  const handleReject = () => {
    if (!rejectNote.trim()) { alert('Isi alasan penolakan terlebih dahulu.'); return; }
    callAction('reject', { rejectedById: currentUserId, rejectionNote: rejectNote });
  };

  const handleMarkTransit = () => callAction('mark-transit', {});

  const handleApproveReceiving = () => {
    if (!confirm('Setujui penerimaan barang ini? Stok akan diperbarui segera.')) return;
    callAction('approve-receiving', { approvedById: currentUserId });
  };

  const totalReceived = po.items.reduce((s, i) => s + parseFloat(i.qtyReceived || '0'), 0);
  const totalOrdered = po.items.reduce((s, i) => s + parseFloat(i.qtyOrdered || '0'), 0);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/purchase-orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke daftar PO
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold font-mono">{po.poNumber}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatWIB(po.createdAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total PO</p>
            <p className="text-2xl font-bold">Rp {parseFloat(po.totalAmount).toLocaleString('id-ID')}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Cabang</p>
            <p className="text-sm font-medium mt-0.5">{po.branch.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Supplier</p>
            <p className="text-sm font-medium mt-0.5">{po.supplier.name}</p>
            {po.supplier.phone && <p className="text-xs text-muted-foreground">{po.supplier.phone}</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target Terima</p>
            <p className="text-sm font-medium mt-0.5">
              {po.targetDeliveryDate
                ? formatWIB(po.targetDeliveryDate)
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">No. Invoice</p>
            <p className="text-sm font-medium mt-0.5">{po.invoiceNumber || '-'}</p>
          </div>
        </div>

        {po.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">Catatan</p>
            <p className="text-sm mt-0.5">{po.notes}</p>
          </div>
        )}

        {po.rejectionNote && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-destructive">Alasan Penolakan</p>
            <p className="text-sm mt-0.5 text-destructive">{po.rejectionNote}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-medium text-foreground">Item PO ({po.items.length} produk)</h2>
          {(po.status === 'PARTIALLY_RECEIVED' || po.status === 'FULLY_RECEIVED') && (
            <span className="text-xs text-muted-foreground">
              Diterima: {totalReceived.toFixed(0)} / {totalOrdered.toFixed(0)} unit
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produk</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty Order</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty Terima</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Harga Beli</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {po.items.map(item => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium text-foreground">{item.productName ?? '-'}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.productSku ?? '-'}</td>
                <td className="px-4 py-3 text-right">
                  {parseFloat(item.qtyOrdered).toFixed(0)} {item.uomCode}
                </td>
                <td className="px-4 py-3 text-right">
                  {parseFloat(item.qtyReceived) > 0 ? (
                    <span className={parseFloat(item.qtyReceived) < parseFloat(item.qtyOrdered) ? 'text-orange-600' : 'text-green-600'}>
                      {parseFloat(item.qtyReceived).toFixed(0)} {item.uomCode}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  Rp {parseFloat(item.invoiceUnitCost ?? item.unitCost).toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  Rp {(parseFloat(item.qtyOrdered) * parseFloat(item.invoiceUnitCost ?? item.unitCost)).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="font-medium text-foreground mb-4">Aksi</h2>

        {po.status === 'PENDING_APPROVAL' && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={loading !== null}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading === 'approve' ? 'Memproses...' : 'Setujui PO'}
              </button>
              <button
                onClick={() => setShowRejectForm(!showRejectForm)}
                disabled={loading !== null}
                className="px-4 py-2 border border-destructive text-destructive text-sm font-medium rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
              >
                Tolak PO
              </button>
            </div>
            {showRejectForm && (
              <div className="space-y-2 pt-2">
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Alasan penolakan..."
                  rows={3}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleReject}
                  disabled={loading !== null}
                  className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {loading === 'reject' ? 'Memproses...' : 'Konfirmasi Tolak'}
                </button>
              </div>
            )}
          </div>
        )}

        {po.status === 'APPROVED' && (
          <button
            onClick={handleMarkTransit}
            disabled={loading !== null}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'mark-transit' ? 'Memproses...' : 'Tandai Dalam Pengiriman'}
          </button>
        )}

        {(po.status === 'PARTIALLY_RECEIVED' || po.status === 'FULLY_RECEIVED') && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Kasir sudah mencatat penerimaan. Verifikasi qty dan harga, lalu setujui untuk memperbarui stok.
            </p>
            <button
              onClick={handleApproveReceiving}
              disabled={loading !== null}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'approve-receiving' ? 'Memproses...' : 'Setujui Penerimaan & Perbarui Stok'}
            </button>
          </div>
        )}

        {po.status === 'CANCELLED' && (
          <p className="text-sm text-muted-foreground">PO ini telah dibatalkan.</p>
        )}

        {po.status === 'IN_TRANSIT' && (
          <p className="text-sm text-muted-foreground">
            Menunggu kasir mencatat penerimaan barang di POS.
          </p>
        )}

        {po.status === 'COMPLETED' && (
          <p className="text-sm text-green-600 font-medium">
            Penerimaan telah disetujui. Stok sudah diperbarui.
          </p>
        )}
      </div>
    </div>
  );
}
