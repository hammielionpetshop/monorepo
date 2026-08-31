'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatWIB } from '@petshop/shared';
import POReceivingNotePrint from './po-receiving-note-print';
import { printPoReceipt } from '@/lib/print-po-receipt';
import { warmUpQz } from '@/lib/print-receipt';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-purple-100 text-purple-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-orange-100 text-orange-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-600' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
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

interface ReceivingLogItem {
  id: number;
  logId: number;
  qtyReceived: number;
  qtyDamaged: number;
  expiryDate: string | null;
  note: string | null;
  productName: string | null;
  productSku: string | null;
  uomCode: string | null;
}

interface ReceivingLog {
  id: number;
  receivedAt: string;
  receivedByName: string | null;
  invoiceReceived: boolean;
  note: string | null;
  items: ReceivingLogItem[];
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
  receivingLogs: ReceivingLog[];
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
  const [printingLogId, setPrintingLogId] = useState<number | null>(null);

  const statusInfo = STATUS_LABELS[po.status] ?? { label: po.status, color: 'bg-gray-100 text-gray-600' };

  // Sambungkan QZ Tray sejak halaman dibuka supaya "Cetak Bukti" langsung lewat jalur raw.
  useEffect(() => {
    warmUpQz();
  }, []);

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

  // Cetak bukti penerimaan: coba raw ESC/POS via QZ Tray (termal, tanpa dialog), fallback
  // ke cetak browser. Log dicari langsung dari prop supaya tidak kena state basi.
  const handlePrintLog = (logId: number) => {
    setPrintingLogId(logId);
    const log = po.receivingLogs.find((l) => l.id === logId);
    const browserPrint = () => setTimeout(() => window.print(), 50);
    if (!log) {
      browserPrint();
      return;
    }
    void printPoReceipt(
      {
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        branchName: po.branch.name,
        receivedByName: log.receivedByName ?? '-',
        receivedAt: new Date(log.receivedAt),
        note: log.note,
        items: log.items.map((item) => ({
          productName: item.productName,
          productSku: item.productSku,
          uomCode: item.uomCode,
          qtyReceived: item.qtyReceived,
          qtyDamaged: item.qtyDamaged,
        })),
      },
      browserPrint
    );
  };

  const canReceive = ['OWNER', 'GM'].includes(role);
  const totalReceived = po.items.reduce((s, i) => s + parseFloat(i.qtyReceived || '0'), 0);
  const totalOrdered = po.items.reduce((s, i) => s + parseFloat(i.qtyOrdered || '0'), 0);
  const printingLog = po.receivingLogs.find(log => log.id === printingLogId) ?? null;

  return (
    <div className="space-y-6">
      {printingLog && (
        <POReceivingNotePrint
          poNumber={po.poNumber}
          supplierName={po.supplier.name}
          branchName={po.branch.name}
          receivedByName={printingLog.receivedByName ?? '-'}
          receivedAt={new Date(printingLog.receivedAt)}
          note={printingLog.note}
          items={printingLog.items.map(item => ({
            productName: item.productName,
            productSku: item.productSku,
            uomCode: item.uomCode,
            qtyReceived: item.qtyReceived,
            qtyDamaged: item.qtyDamaged,
          }))}
        />
      )}

      {/* Back */}
      <Link href="/purchase-orders" className="text-sm text-muted-foreground hover:text-foreground print:hidden">
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

      {/* Riwayat Penerimaan */}
      {po.receivingLogs.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden print:hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-medium text-foreground">Riwayat Penerimaan ({po.receivingLogs.length})</h2>
          </div>
          <div className="divide-y divide-border">
            {po.receivingLogs.map(log => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatWIB(log.receivedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Diterima oleh {log.receivedByName ?? '-'}
                      {log.invoiceReceived && ' · Invoice/surat jalan diterima'}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePrintLog(log.id)}
                    className="px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cetak Bukti
                  </button>
                </div>

                <div className="mt-3 space-y-1.5">
                  {log.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.productName ?? '-'}</span>
                      <span className="text-muted-foreground">
                        {item.qtyReceived} {item.uomCode}
                        {item.qtyDamaged > 0 && (
                          <span className="text-destructive"> (rusak {item.qtyDamaged} {item.uomCode})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {log.note && (
                  <p className="mt-2 text-xs text-muted-foreground italic">Catatan: {log.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-card border border-border rounded-lg p-6 print:hidden">
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
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleMarkTransit}
              disabled={loading !== null}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'mark-transit' ? 'Memproses...' : 'Tandai Dalam Pengiriman'}
            </button>
            {canReceive && (
              <Link
                href={`/purchase-orders/${po.id}/receive`}
                className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-md hover:bg-primary/10 transition-colors"
              >
                Catat Penerimaan Barang
              </Link>
            )}
          </div>
        )}

        {(po.status === 'PARTIALLY_RECEIVED' || po.status === 'FULLY_RECEIVED') && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verifikasi qty dan harga penerimaan, lalu setujui untuk memperbarui stok.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleApproveReceiving}
                disabled={loading !== null}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loading === 'approve-receiving' ? 'Memproses...' : 'Setujui Penerimaan & Perbarui Stok'}
              </button>
              {canReceive && po.status === 'PARTIALLY_RECEIVED' && (
                <Link
                  href={`/purchase-orders/${po.id}/receive`}
                  className="px-4 py-2 border border-primary text-primary text-sm font-medium rounded-md hover:bg-primary/10 transition-colors"
                >
                  Lanjutkan Penerimaan
                </Link>
              )}
            </div>
          </div>
        )}

        {po.status === 'CANCELLED' && (
          <p className="text-sm text-muted-foreground">PO ini telah dibatalkan.</p>
        )}

        {po.status === 'REJECTED' && (
          <p className="text-sm text-destructive">PO ini telah ditolak.</p>
        )}

        {po.status === 'IN_TRANSIT' && (
          canReceive ? (
            <Link
              href={`/purchase-orders/${po.id}/receive`}
              className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
            >
              Catat Penerimaan Barang
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Menunggu penerimaan barang.</p>
          )
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
