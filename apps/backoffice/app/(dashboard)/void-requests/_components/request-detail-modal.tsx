'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ItemSnapshot {
  transactionItemId: number | null
  productId: number | null
  productName: string
  uomId: number | null
  uomCode: string
  qty: number
  unitPrice: number
  discountAmount: number
  totalPrice: number
}

type DiffKind = 'UNCHANGED' | 'CHANGED' | 'ADDED' | 'REMOVED'

interface ItemDiffRow {
  kind: DiffKind
  before: ItemSnapshot | null
  after: ItemSnapshot | null
}

interface PaymentSnapshot {
  paymentMethodId: number
  paymentMethodName: string
  amount: number
  referenceNumber?: string | null
}

interface RequestDetail {
  request: {
    id: number
    status: string
    kind: 'VOID' | 'KOREKSI'
    reason: string
    createdAt: string
    updatedAt: string
    requestByName: string
  }
  transaction: {
    id: number
    trxNumber: string
    branchName: string
    cashierName: string
    customerName: string | null
    status: string
    totalAmount: number
    discountAmount: number
    payableAmount: number
    paidAmount: number
    changeAmount: number
    createdAt: string
  }
  currentItems: ItemSnapshot[]
  currentPayments: PaymentSnapshot[]
  payloadInvalid?: boolean
  payloadInvalidReason?: string
  // PROPOSED = permintaan belum diterapkan (PENDING/REJECTED) — "sebelum" adalah isi nota
  // saat ini, "sesudah" adalah muatan yang diajukan. APPLIED = koreksi sudah disetujui &
  // diterapkan — "sebelum" diambil dari snapshot riwayat koreksi, "sesudah" adalah isi nota
  // saat ini (yang sudah berubah).
  mode?: 'PROPOSED' | 'APPLIED'
  afterItems?: ItemSnapshot[]
  itemDiff?: ItemDiffRow[]
  beforeTotal?: number
  afterTotal?: number
  beforePayments?: PaymentSnapshot[] | null
  afterPayments?: PaymentSnapshot[]
  afterCustomerName?: string | null
  afterDueAt?: string | null
}

interface RequestDetailModalProps {
  requestId: number
  onClose: () => void
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const DIFF_BADGE: Record<DiffKind, string> = {
  UNCHANGED: 'bg-muted text-muted-foreground',
  CHANGED: 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400',
  ADDED: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  REMOVED: 'bg-destructive/10 border border-destructive/30 text-destructive',
}

const DIFF_LABEL: Record<DiffKind, string> = {
  UNCHANGED: 'Tetap',
  CHANGED: 'Diubah',
  ADDED: 'Ditambah',
  REMOVED: 'Dihapus',
}

function ItemsTable({ items, title }: { items: ItemSnapshot[]; title: string }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
        {title} ({items.length})
      </h4>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">Produk</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-center">Qty</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right">Harga</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground text-xs">
                  Tidak ada item
                </td>
              </tr>
            )}
            {items.map((item, idx) => (
              <tr key={item.transactionItemId ?? `new-${idx}`}>
                <td className="px-3 py-2 text-foreground">{item.productName}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap text-muted-foreground">
                  {item.qty} {item.uomCode}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                  {formatRupiah(item.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-foreground">
                  {formatRupiah(item.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DiffTable({ rows }: { rows: ItemDiffRow[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
        Perubahan Item
      </h4>
      <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Sebelum</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Sesudah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2 align-top">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${DIFF_BADGE[row.kind]}`}>
                    {DIFF_LABEL[row.kind]}
                  </span>
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground">
                  {row.before ? (
                    <>
                      <p className="text-foreground font-medium">{row.before.productName}</p>
                      <p>
                        {row.before.qty} {row.before.uomCode} &times; {formatRupiah(row.before.unitPrice)}
                        {row.before.discountAmount > 0 && (
                          <> &minus; {formatRupiah(row.before.discountAmount)}</>
                        )}
                      </p>
                      <p className="font-medium text-foreground">{formatRupiah(row.before.totalPrice)}</p>
                    </>
                  ) : (
                    <span className="italic">Item baru</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground">
                  {row.after ? (
                    <>
                      <p className="text-foreground font-medium">{row.after.productName}</p>
                      <p>
                        {row.after.qty} {row.after.uomCode} &times; {formatRupiah(row.after.unitPrice)}
                        {row.after.discountAmount > 0 && (
                          <> &minus; {formatRupiah(row.after.discountAmount)}</>
                        )}
                      </p>
                      <p className="font-medium text-foreground">{formatRupiah(row.after.totalPrice)}</p>
                    </>
                  ) : (
                    <span className="italic">Dihapus</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RequestDetailModal({ requestId, onClose }: RequestDetailModalProps) {
  const [detail, setDetail] = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/bo/void-requests/${requestId}/detail`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data?.error ?? 'Gagal mengambil detail permintaan')
        }
        setDetail(data as RequestDetail)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mengambil detail permintaan')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [requestId])

  const isKoreksi = detail?.request.kind === 'KOREKSI'
  const isApplied = detail?.mode === 'APPLIED'
  const customerChanged =
    isKoreksi && !isApplied && detail?.afterCustomerName !== undefined &&
    (detail?.afterCustomerName ?? null) !== (detail?.transaction.customerName ?? null)

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Detail Permintaan Persetujuan"
      >
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-bold text-foreground">
              Detail Permintaan {detail && <span className="font-mono text-primary">{detail.transaction.trxNumber}</span>}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Memuat detail...</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                {error}
              </div>
            )}

            {!loading && !error && detail && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 border border-border/50 rounded-xl p-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Jenis:</span>
                      <span className="font-medium text-foreground">
                        {isKoreksi ? 'Koreksi Transaksi' : 'Void Transaksi'}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Cabang:</span>
                      <span className="font-medium text-foreground">{detail.transaction.branchName}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Kasir:</span>
                      <span className="font-medium text-foreground">{detail.transaction.cashierName}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Tgl Transaksi:</span>
                      <span className="font-medium text-foreground">{formatDateTime(detail.transaction.createdAt)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Diajukan oleh:</span>
                      <span className="font-medium text-foreground">{detail.request.requestByName}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Diajukan:</span>
                      <span className="font-medium text-foreground">{formatDateTime(detail.request.createdAt)}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Status:</span>
                      <span className="font-medium text-foreground">{detail.request.status}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Alasan:</span>
                      <span className="font-medium text-foreground">{detail.request.reason}</span>
                    </div>
                  </div>
                </div>

                {isKoreksi && detail.payloadInvalid && (
                  <div className="px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                    Data koreksi yang diajukan sudah tidak valid ({detail.payloadInvalidReason}). Kasir perlu
                    mengajukan ulang. Menampilkan isi nota saat ini saja.
                  </div>
                )}

                {isKoreksi && !detail.payloadInvalid ? (
                  <>
                    {detail.itemDiff && <DiffTable rows={detail.itemDiff} />}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                      <div className="space-y-2 text-sm">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Pembayaran Sebelum
                        </h4>
                        {detail.beforePayments === null ? (
                          <p className="text-xs text-muted-foreground italic">
                            Rincian metode pembayaran sebelum koreksi tidak tersimpan.
                          </p>
                        ) : (
                          (detail.beforePayments ?? []).map((p, idx) => (
                            <div key={idx} className="flex justify-between bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                              <span className="text-muted-foreground">{p.paymentMethodName}</span>
                              <span className="font-medium text-foreground">{formatRupiah(p.amount)}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Pembayaran Sesudah
                        </h4>
                        {(detail.afterPayments ?? []).map((p, idx) => (
                          <div key={idx} className="flex justify-between bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                            <span className="text-muted-foreground">{p.paymentMethodName}</span>
                            <span className="font-medium text-foreground">{formatRupiah(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {customerChanged && (
                      <div className="text-sm bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Pelanggan: </span>
                        <span className="text-foreground">
                          {detail.transaction.customerName ?? 'Umum'} &rarr; {detail.afterCustomerName ?? 'Umum'}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-base text-foreground pt-2 border-t border-border/50">
                      <span>Total Sebelum &rarr; Sesudah</span>
                      <span>
                        {formatRupiah(detail.beforeTotal ?? detail.transaction.payableAmount)} &rarr;{' '}
                        {formatRupiah(detail.afterTotal ?? 0)}
                      </span>
                    </div>
                  </>
                ) : (
                  <ItemsTable items={detail.currentItems} title="Daftar Item" />
                )}
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex-shrink-0 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
