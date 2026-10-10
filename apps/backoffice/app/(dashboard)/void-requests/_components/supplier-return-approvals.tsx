'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Printer, XCircle } from 'lucide-react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import { SupplierReturnItems, SupplierReturnOutcome } from '@/components/supplier-returns/supplier-return-list'
import {
  REASON_LABELS,
  formatDateTimeWib,
  formatRupiah,
  type SupplierReturnStatus,
  type SupplierReturnView,
} from '@/components/supplier-returns/types'

/**
 * Antrean persetujuan Retur ke Supplier di layar Permintaan Persetujuan. Disetujui → stok
 * keluar (FIFO), tagihan PO asal dipotong, kelebihannya jadi saldo supplier.
 */
export function SupplierReturnApprovals({ status, onChanged }: { status: SupplierReturnStatus; onChanged: () => void }) {
  const [rows, setRows] = useState<SupplierReturnView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [approving, setApproving] = useState<SupplierReturnView | null>(null)
  const [prices, setPrices] = useState<Record<number, string>>({})
  const [rejecting, setRejecting] = useState<SupplierReturnView | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/supplier-returns?status=${status}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Gagal mengambil pengajuan retur supplier')
      setRows(Array.isArray(data.data) ? data.data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengambil pengajuan retur supplier')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  function openApprove(row: SupplierReturnView) {
    setApproving(row)
    setActionError(null)
    setPrices(Object.fromEntries(row.items.map(it => [it.id, String(it.unitPrice)])))
  }

  const editablePrices = approving ? !approving.poId : false
  // Retur ber-PO dinilai dengan harga faktur PO SAAT DISETUJUI (server menghitung ulang), jadi
  // popup memakai harga terbaru itu — bukan harga saat diajukan.
  const approvePrice = (it: SupplierReturnView['items'][number]) =>
    editablePrices ? Number(prices[it.id] || 0) : (it.currentUnitPrice ?? it.unitPrice)
  const approveTotal = approving ? approving.items.reduce((acc, it) => acc + approvePrice(it) * it.qty, 0) : 0
  const changedPrices = approving && !editablePrices
    ? approving.items.filter(it => it.currentUnitPrice != null && it.currentUnitPrice !== it.unitPrice)
    : []
  const pricePending = approving && !editablePrices
    ? approving.items.some(it => it.fromPo && it.currentUnitPrice == null)
    : false

  async function handleApprove() {
    if (!approving) return
    if (approveTotal <= 0) return setActionError('Nilai retur masih Rp 0 — isi harga barangnya dulu')
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/bo/supplier-returns/${approving.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editablePrices
            ? { prices: approving.items.map(it => ({ itemId: it.id, unitPrice: Number(prices[it.id] || 0) })) }
            : {},
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Gagal menyetujui retur')
      const r = data.data
      setSuccessMsg(
        `Retur ${approving.returnNumber} disetujui — stok keluar` +
          (r?.payableDeduction > 0 ? `, tagihan ${approving.poNumber} dipotong ${formatRupiah(r.payableDeduction)}` : '') +
          (r?.creditAmount > 0 ? `, saldo supplier bertambah ${formatRupiah(r.creditAmount)}` : '') +
          '.',
      )
      setApproving(null)
      load()
      onChanged()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal menyetujui retur')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!rejecting) return
    if (!rejectReason.trim()) return setActionError('Alasan penolakan wajib diisi')
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/bo/supplier-returns/${rejecting.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Gagal menolak retur')
      setSuccessMsg(`Retur ${rejecting.returnNumber} ditolak — stok dan tagihan tidak berubah.`)
      setRejecting(null)
      setRejectReason('')
      load()
      onChanged()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal menolak retur')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      {successMsg && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-md text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          {status === 'PENDING' ? 'Tidak ada retur supplier yang menunggu persetujuan.' : 'Tidak ada data.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
                      RETUR SUPPLIER
                    </span>
                    <span className="font-mono font-semibold text-foreground">{row.returnNumber}</span>
                    <span className="font-bold text-foreground">{formatRupiah(row.totalValue)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{row.branchName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {row.source === 'POS' ? 'dari POS' : 'dari Back Office'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">
                    <span className="text-muted-foreground">Supplier:</span> {row.supplierName} ·{' '}
                    <span className="text-muted-foreground">PO asal:</span>{' '}
                    {row.poNumber ? (
                      <a href={`/purchase-orders/${row.poId}`} className="font-mono text-primary hover:underline">{row.poNumber}</a>
                    ) : (
                      'tanpa PO (masuk saldo supplier)'
                    )}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    <span className="text-muted-foreground">Alasan:</span> {REASON_LABELS[row.reason] ?? row.reason} — {row.notes}
                  </p>
                  <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                    <SupplierReturnItems row={row} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      Diajukan {formatDateTimeWib(row.requestedAt)}
                    </span>
                    <span>Oleh: {row.requestedByName}</span>
                    {row.resolvedAt && <span>Diproses {formatDateTimeWib(row.resolvedAt)} oleh {row.resolvedByName ?? '-'}</span>}
                  </div>
                  <div className="mt-1"><SupplierReturnOutcome row={row} /></div>
                  {row.status === 'REJECTED' && row.rejectionReason && (
                    <p className="mt-1 text-xs text-destructive">Ditolak: {row.rejectionReason}</p>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={`/purchase-orders/supplier-returns/${row.id}/cetak`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Cetak
                  </a>
                  {status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setRejecting(row); setRejectReason(''); setActionError(null) }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Tolak
                      </button>
                      <button
                        type="button"
                        onClick={() => openApprove(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Setujui
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {approving && (
        <RequiredChoiceDialog
          title={`Setujui Retur ${approving.returnNumber}?`}
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setApproving(null), variant: 'secondary', disabled: actionLoading },
            { label: actionLoading ? 'Memproses...' : 'Ya, Setujui Retur', onClick: handleApprove, variant: 'primary', disabled: actionLoading },
          ]}
        >
          <p>
            Stok {approving.items.length} barang di <b>{approving.branchName}</b> akan <b>dikurangi</b>.{' '}
            {approving.poId ? (
              <>Tagihan <b>{approving.poNumber}</b> dipotong; kalau sudah lunas atau sisanya kurang, kelebihannya masuk Saldo Supplier.</>
            ) : (
              <>Tanpa PO asal — seluruh nilai masuk <b>Saldo Supplier {approving.supplierName}</b>.</>
            )}
          </p>
          {editablePrices && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Harga per satuan (modal terakhir) — ubah bila harga yang disepakati dengan supplier berbeda:</p>
              {approving.items.map(it => (
                <div key={it.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{it.qty} {it.uomCode} · {it.productName}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRupiahInput(prices[it.id] ?? '')}
                    onChange={e => setPrices(prev => ({ ...prev, [it.id]: digitsOnly(e.target.value) }))}
                    onFocus={e => e.target.select()}
                    className="w-32 rounded-md border border-border bg-background px-2 py-1 text-right text-sm"
                    aria-label={`Harga ${it.productName}`}
                  />
                </div>
              ))}
            </div>
          )}
          {changedPrices.length > 0 && (
            <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Harga faktur PO sudah berubah sejak retur diajukan:</p>
              {changedPrices.map(it => (
                <p key={it.id}>
                  {it.productName}: {formatRupiah(it.unitPrice)} → <b>{formatRupiah(it.currentUnitPrice ?? 0)}</b> per {it.uomCode}
                </p>
              ))}
              <p className="text-xs">Nilai retur di bawah sudah memakai harga terbaru.</p>
            </div>
          )}
          {pricePending && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Harga faktur PO asal untuk sebagian barang belum diisi — isi harga beli PO itu dulu, baru retur bisa disetujui.
            </div>
          )}
          <p>
            Nilai retur: <b>{formatRupiah(approveTotal)}</b>
          </p>
          <p className="text-muted-foreground">Pastikan barangnya benar-benar dikembalikan ke supplier. Persetujuan tidak bisa dibatalkan.</p>
          {actionError && (
            <div role="alert" className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">{actionError}</div>
          )}
        </RequiredChoiceDialog>
      )}

      {rejecting && (
        <RequiredChoiceDialog
          title={`Tolak Retur ${rejecting.returnNumber}?`}
          actions={[
            { label: 'Batal', onClick: () => setRejecting(null), variant: 'secondary', disabled: actionLoading },
            { label: actionLoading ? 'Memproses...' : 'Tolak Pengajuan', onClick: handleReject, variant: 'destructive', disabled: actionLoading },
          ]}
        >
          <p className="text-muted-foreground">Stok dan tagihan supplier tidak berubah.</p>
          <label className="block text-sm font-medium text-foreground">
            Alasan penolakan <span className="text-destructive">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          {actionError && (
            <div role="alert" className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">{actionError}</div>
          )}
        </RequiredChoiceDialog>
      )}
    </div>
  )
}
