'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatWIB } from '@petshop/shared';
import { daysUntilDue } from '@/lib/supplier-due-date';
import POReceivingNotePrint from './po-receiving-note-print';
import { printPoReceipt } from '@/lib/print-po-receipt';
import { warmUpQz } from '@/lib/print-receipt';
import type { PoDocumentData } from '@/lib/po-document-layout';
import PoDocumentExport from './po-document-export';
import PoInvoiceMatch from './po-invoice-match';
import { effectiveUnitCost, isPricePending } from '../../_components/po-item-defaults';
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog';
import { PO_STAGE_INFO, poStage } from '@/lib/po-stage';
import { SupplierPaymentDialog } from '../../supplier-payables/_components/supplier-payment-dialog';

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

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
  /** Modal terakhir satuan ini di cabang PO — pengingat saat mengisi harga faktur. */
  lastCost: number | null;
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
  createdByName: string | null;
  supplier: { id: number; name: string; phone: string | null };
  branch: { id: number; name: string };
  items: POItem[];
  receivingLogs: ReceivingLog[];
  /** Barang yang sudah masuk tapi harga fakturnya belum ada (tahap "Belum Ada Harga"). */
  pricePendingReceived: number;
  payable: {
    id: number;
    /** Tagihan perkiraan bila masih ada barang tanpa harga faktur. */
    estimatedTotal: number;
    paymentTermDays: number | null;
    totalAmount: number;
    paidAmount: number;
    status: string;
    /** YYYY-MM-DD (WIB); null = termin supplier belum diatur. */
    dueDate: string | null;
    today: string;
  } | null;
}

const PAYABLE_STATUS: Record<string, { label: string; color: string }> = {
  UNPAID: { label: 'Belum Bayar', color: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Dibayar Sebagian', color: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: 'Lunas', color: 'bg-green-100 text-green-800' },
  WAIVED: { label: 'Dihapus', color: 'bg-gray-100 text-gray-500' },
};

export function PODetailClient({
  po,
  currentUserId,
  role,
  canEditInvoice,
  isNew,
  canPay,
  paymentMethods,
  today,
}: {
  po: PO;
  currentUserId: number;
  role: string;
  canEditInvoice: boolean;
  isNew: boolean;
  canPay: boolean;
  paymentMethods: { id: number; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmApproveReceiving, setConfirmApproveReceiving] = useState(false);
  const [cancelReceivingOpen, setCancelReceivingOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  // Jendela "dibayar sekarang?" ditunda sampai data PO segar (setelah router.refresh) supaya
  // nominal yang tampil adalah tagihan terbaru, bukan sebelum penerimaan/harga disimpan.
  const [paymentPromptQueued, setPaymentPromptQueued] = useState(false);
  const [paying, setPaying] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [printingLogId, setPrintingLogId] = useState<number | null>(null);

  const stage = poStage(po.status, po.pricePendingReceived);
  const statusInfo = PO_STAGE_INFO[stage];

  const refresh = () => startRefresh(() => router.refresh());

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // Sambungkan QZ Tray sejak halaman dibuka supaya "Cetak Bukti" langsung lewat jalur raw.
  useEffect(() => {
    warmUpQz();
  }, []);

  async function callAction(endpoint: string, body: object): Promise<boolean> {
    setLoading(endpoint);
    try {
      const res = await fetch(`/api/bo/purchase-orders/${po.id}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
      refresh();
      return true;
    } catch (err: any) {
      alert(err.message);
      return false;
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

  const handleApproveReceiving = async () => {
    setConfirmApproveReceiving(false);
    const ok = await callAction('approve-receiving', { approvedById: currentUserId });
    if (ok) setPaymentPromptQueued(true);
  };

  const handleCancelReceiving = async () => {
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      setCancelError('Alasan pembatalan wajib diisi (minimal 5 huruf)');
      return;
    }
    setLoading('cancel-receiving');
    setCancelError('');
    try {
      const res = await fetch(`/api/bo/purchase-orders/${po.id}/cancel-receiving`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
      setCancelReceivingOpen(false);
      setCancelReason('');
      setSuccessMsg(data.message ?? 'Input penerimaan dibatalkan');
      refresh();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(null);
    }
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

  const dateOnly = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
  const documentData: PoDocumentData = {
    poNumber: po.poNumber,
    poDate: formatWIB(po.createdAt, dateOnly),
    supplierName: po.supplier.name,
    supplierPhone: po.supplier.phone,
    branchName: po.branch.name,
    targetDate: po.targetDeliveryDate ? formatWIB(po.targetDeliveryDate, dateOnly) : null,
    notes: po.notes,
    items: po.items.map(item => ({
      productName: item.productName ?? '-',
      productSku: item.productSku,
      uomCode: item.uomCode ?? '',
      qtyOrdered: Number(item.qtyOrdered),
    })),
  };
  const canMatchInvoice =
    canEditInvoice && ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'COMPLETED'].includes(po.status);
  const pricePendingCount = stage === 'BELUM_HARGA' ? po.pricePendingReceived : 0;

  const payable = po.payable;
  const payableRemaining = payable ? Math.max(payable.totalAmount - payable.paidAmount, 0) : 0;
  const showPaymentPrompt =
    paymentPromptQueued && !isRefreshing && !paying && payable !== null && payable.status !== 'PAID' && payable.status !== 'WAIVED';
  const suggestPayNow = payable?.paymentTermDays === 0;

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

      {isNew && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-foreground print:hidden">
          <span className="font-semibold">Purchase Order berhasil dibuat.</span>{' '}
          Simpan sebagai PDF atau foto di bawah untuk dikirim ke supplier — harga tidak ikut tercetak.
        </div>
      )}

      {pricePendingCount > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground print:hidden">
          <span className="font-semibold">{pricePendingCount} barang belum ada harga faktur.</span>{' '}
          Stoknya sudah masuk dengan harga perkiraan. Setelah faktur supplier datang, isi harganya lewat tombol{' '}
          <span className="font-medium">Isi Harga Beli</span> di bawah — modal stok & hutang supplier ikut diperbarui,
          lalu PO pindah ke Selesai.
        </div>
      )}

      {successMsg && (
        <div role="status" aria-live="polite" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 print:hidden">
          {successMsg}
        </div>
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
              {po.createdByName && <> · Dibuat oleh <span className="font-medium text-foreground">{po.createdByName}</span></>}
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

        {po.payable && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-x-6 gap-y-2 print:hidden">
            <div>
              <p className="text-xs text-muted-foreground">Pembayaran ke Supplier</p>
              {stage === 'BELUM_HARGA' && po.payable.status !== 'PAID' ? (
                <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Menunggu Faktur
                </span>
              ) : (
                <span className={`inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${(PAYABLE_STATUS[po.payable.status] ?? PAYABLE_STATUS.UNPAID).color}`}>
                  {(PAYABLE_STATUS[po.payable.status] ?? { label: po.payable.status }).label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tagihan</p>
              {stage === 'BELUM_HARGA' ? (
                <p className="text-sm font-medium mt-0.5 text-amber-800">≈ {rupiah(po.payable.estimatedTotal)} <span className="text-xs">(perkiraan)</span></p>
              ) : (
                <p className="text-sm font-medium mt-0.5">Rp {po.payable.totalAmount.toLocaleString('id-ID')}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sudah Bayar</p>
              <p className="text-sm font-medium mt-0.5 text-green-600">Rp {po.payable.paidAmount.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sisa</p>
              <p className="text-sm font-medium mt-0.5 text-red-600">
                Rp {Math.max(po.payable.totalAmount - po.payable.paidAmount, 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jatuh Tempo</p>
              {(() => {
                const p = po.payable;
                if (!p.dueDate) return <p className="text-sm font-medium mt-0.5">-</p>;
                const open = p.status === 'UNPAID' || p.status === 'PARTIAL';
                const days = daysUntilDue(p.dueDate, p.today);
                return (
                  <p className={`text-sm font-medium mt-0.5 ${open && days < 0 ? 'text-destructive' : ''}`}>
                    {formatWIB(`${p.dueDate}T12:00:00+07:00`)}
                    {open && days < 0 && <span className="text-xs"> · terlambat {-days} hari</span>}
                  </p>
                );
              })()}
            </div>
            <a
              href={`/purchase-orders/supplier-payables?q=${encodeURIComponent(po.poNumber)}`}
              className="ml-auto text-xs font-medium text-primary hover:underline"
            >
              Lihat di Hutang Supplier →
            </a>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 print:hidden">
          <p className="text-xs text-muted-foreground">Kirim ke supplier (tanpa harga):</p>
          <PoDocumentExport data={documentData} />
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
                  {isPricePending(item) ? (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Harga menyusul</span>
                  ) : (
                    <>Rp {effectiveUnitCost(item).toLocaleString('id-ID')}</>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {isPricePending(item)
                    ? '-'
                    : `Rp ${(parseFloat(item.qtyOrdered) * effectiveUnitCost(item)).toLocaleString('id-ID')}`}
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
                onClick={() => setConfirmApproveReceiving(true)}
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
              {canReceive && (
                <button
                  type="button"
                  onClick={() => { setCancelReason(''); setCancelError(''); setCancelReceivingOpen(true); }}
                  disabled={loading !== null}
                  className="px-4 py-2 border border-destructive/40 text-destructive text-sm font-medium rounded-md hover:bg-destructive/5 disabled:opacity-50 transition-colors"
                >
                  Batalkan Input Penerimaan
                </button>
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

        {stage === 'SELESAI' && (
          <p className="text-sm text-green-600 font-medium">
            Penerimaan telah disetujui. Stok sudah diperbarui.
          </p>
        )}

        {stage === 'BELUM_HARGA' && (
          <p className="text-sm text-amber-700 font-medium">
            Stok sudah diperbarui. Tinggal isi harga faktur untuk {pricePendingCount} barang.
          </p>
        )}

        {canMatchInvoice && (
          <div className="mt-4 pt-4 border-t border-border">
            <PoInvoiceMatch
              poId={po.id}
              invoiceNumber={po.invoiceNumber}
              items={po.items}
              receivingApproved={po.status === 'COMPLETED'}
              hasPendingPrice={pricePendingCount > 0}
              onSaved={() => {
                setSuccessMsg('Harga faktur disimpan');
                refresh();
                setPaymentPromptQueued(true);
              }}
            />
          </div>
        )}
      </div>

      {confirmApproveReceiving && (
        <RequiredChoiceDialog
          title="Setujui penerimaan barang?"
          actions={[
            { label: 'Batal', onClick: () => setConfirmApproveReceiving(false) },
            { label: 'Ya, setujui & masukkan stok', onClick: handleApproveReceiving, variant: 'primary' },
          ]}
        >
          <p>Stok cabang <span className="font-medium">{po.branch.name}</span> akan bertambah dan hutang ke <span className="font-medium">{po.supplier.name}</span> dicatat.</p>
          {po.items.some(item => Number(item.qtyReceived) - Number(item.qtyDamaged) > 0 && isPricePending(item)) && (
            <p className="text-amber-700">Ada barang tanpa harga faktur — stoknya masuk dengan harga perkiraan dan PO berada di &quot;Belum Ada Harga&quot; sampai harganya diisi.</p>
          )}
        </RequiredChoiceDialog>
      )}

      {cancelReceivingOpen && (
        <RequiredChoiceDialog
          title="Batalkan input penerimaan?"
          tone="danger"
          actions={[
            { label: 'Kembali', onClick: () => setCancelReceivingOpen(false), disabled: loading === 'cancel-receiving' },
            {
              label: loading === 'cancel-receiving' ? 'Memproses...' : 'Ya, batalkan input',
              onClick: handleCancelReceiving,
              variant: 'destructive',
              disabled: loading === 'cancel-receiving',
            },
          ]}
        >
          <p>Qty yang sudah diinput dihapus dan PO kembali ke tahap <span className="font-medium">Disetujui</span>, siap diterima ulang. Stok belum berubah, jadi tidak ada stok yang dibalik.</p>
          <label className="block">
            <span className="text-sm font-medium">Alasan <span className="text-destructive">*</span></span>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Contoh: salah ketik qty, barang dihitung ulang"
              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}
        </RequiredChoiceDialog>
      )}

      {showPaymentPrompt && payable && stage === 'BELUM_HARGA' && (
        <RequiredChoiceDialog
          title="Penerimaan disetujui ✓"
          tone="warning"
          actions={[{ label: 'Mengerti', onClick: () => setPaymentPromptQueued(false), variant: 'primary' }]}
        >
          <p className="font-mono text-xs text-muted-foreground">{po.poNumber} · {po.supplier.name}</p>
          <p className="text-amber-800">⚠ {pricePendingCount} barang harga menyusul.</p>
          <p>Tagihan sementara: <span className="font-semibold">≈ {rupiah(payable.estimatedTotal)}</span> (perkiraan).</p>
          <p className="text-muted-foreground">Hutang lengkap setelah harga diisi lewat &quot;Isi Harga Beli&quot;. Pembayaran dicatat setelah itu.</p>
        </RequiredChoiceDialog>
      )}

      {showPaymentPrompt && payable && stage !== 'BELUM_HARGA' && (
        <RequiredChoiceDialog
          title="Tagihan supplier tercatat ✓"
          tone="success"
          actions={
            canPay
              ? [
                  { label: 'Nanti (Tempo)', onClick: () => setPaymentPromptQueued(false), variant: suggestPayNow ? 'secondary' : 'primary' },
                  { label: 'Catat Bayar', onClick: () => { setPaymentPromptQueued(false); setPaying(true); }, variant: suggestPayNow ? 'primary' : 'secondary' },
                ]
              : [{ label: 'Mengerti', onClick: () => setPaymentPromptQueued(false), variant: 'primary' }]
          }
        >
          <p className="font-mono text-xs text-muted-foreground">{po.poNumber} · {po.supplier.name}</p>
          <p>Tagihan: <span className="font-semibold">{rupiah(payable.totalAmount)}</span>{payable.paidAmount > 0 && <> · sisa <span className="font-semibold">{rupiah(payableRemaining)}</span></>}</p>
          {canPay ? (
            <p>Apakah PO ini dibayar sekarang?</p>
          ) : (
            <p className="text-muted-foreground">Tagihan dicatat sebagai hutang di menu Hutang Supplier.</p>
          )}
          {canPay && payable.paymentTermDays != null && (
            <p className="text-xs text-muted-foreground">
              Termin {po.supplier.name}: {payable.paymentTermDays === 0 ? 'tunai' : `${payable.paymentTermDays} hari`}.
            </p>
          )}
        </RequiredChoiceDialog>
      )}

      {paying && payable && (
        <SupplierPaymentDialog
          target={{ id: payable.id, poNumber: po.poNumber, supplierName: po.supplier.name, remaining: payableRemaining }}
          paymentMethods={paymentMethods}
          today={today}
          onClose={() => setPaying(false)}
          onSaved={(message) => {
            setPaying(false);
            setSuccessMsg(message);
            refresh();
          }}
        />
      )}
    </div>
  );
}
