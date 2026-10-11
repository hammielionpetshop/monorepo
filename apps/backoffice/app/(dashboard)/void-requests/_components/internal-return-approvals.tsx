'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Printer, XCircle } from 'lucide-react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import {
  InternalReturnItems,
  InternalReturnOutcome,
  internalReturnValueText,
} from '@/components/internal-returns/internal-return-list'
import { PriceRevisionApproveDialog } from '@/components/internal-returns/price-revision-approve-dialog'
import { formatDateTimeWib, formatRupiah } from '@/components/supplier-returns/types'
import {
  INTERNAL_KIND_LABELS,
  INTERNAL_REASON_LABELS,
  estimateInternalReturnSplit,
  isPriceRevision,
  type InternalReturnStatus,
  type InternalReturnView,
} from '@/components/internal-returns/types'

/**
 * Antrean persetujuan Retur Internal di layar Permintaan Persetujuan. "Barang Dikembalikan"
 * disetujui → stok penerima keluar, stok cabang pengirim masuk lagi, nota Bulk Sale dikurangi,
 * hutang internal dipotong; kelebihannya jadi Saldo Internal. "Revisi Harga Beli" punya popup
 * sendiri (harga final bisa diubah + pratinjau modal yang dikoreksi).
 */
export function InternalReturnApprovals({ status, onChanged }: { status: InternalReturnStatus; onChanged: () => void }) {
  const [rows, setRows] = useState<InternalReturnView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [approving, setApproving] = useState<InternalReturnView | null>(null)
  const [rejecting, setRejecting] = useState<InternalReturnView | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/internal-returns?status=${status}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Gagal mengambil pengajuan retur internal')
      setRows(Array.isArray(data.data) ? data.data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengambil pengajuan retur internal')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const split = approving && !isPriceRevision(approving) ? estimateInternalReturnSplit(approving) : null

  async function handleApprove() {
    if (!approving) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/bo/internal-returns/${approving.id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Gagal menyetujui retur internal')
      const r = data.data
      setSuccessMsg(
        `Retur ${approving.returnNumber} disetujui — stok kembali ke ${approving.senderBranchName}` +
          (r?.payableDeduction > 0 ? `, hutang internal ${approving.ibtNumber} dipotong ${formatRupiah(r.payableDeduction)}` : '') +
          (r?.creditAmount > 0 ? `, ${formatRupiah(r.creditAmount)} masuk Saldo Internal (otomatis memotong tagihan internal lain)` : '') +
          '.',
      )
      setApproving(null)
      load()
      onChanged()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal menyetujui retur internal')
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
      const res = await fetch(`/api/bo/internal-returns/${rejecting.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Gagal menolak retur internal')
      setSuccessMsg(`${isPriceRevision(rejecting) ? 'Revisi harga' : 'Retur'} ${rejecting.returnNumber} ditolak — ${isPriceRevision(rejecting) ? 'harga, modal' : 'stok'} dan hutang internal tidak berubah.`)
      setRejecting(null)
      setRejectReason('')
      load()
      onChanged()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal menolak retur internal')
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
          {status === 'PENDING' ? 'Tidak ada retur internal yang menunggu persetujuan.' : 'Tidak ada data.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-primary/10 border-primary/30 text-primary">
                      RETUR INTERNAL
                    </span>
                    <span className="font-mono font-semibold text-foreground">{row.returnNumber}</span>
                    <span className="font-bold text-foreground">{internalReturnValueText(row)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {INTERNAL_KIND_LABELS[row.kind] ?? row.kind}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {row.source === 'POS' ? 'dari POS' : 'dari Back Office'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">
                    <span className="text-muted-foreground">{isPriceRevision(row) ? 'Penerima:' : 'Dari:'}</span> {row.receiverBranchName}{' '}
                    <span className="text-muted-foreground">{isPriceRevision(row) ? '· pengirim:' : '→ kembali ke:'}</span> {row.senderBranchName} ·{' '}
                    <span className="text-muted-foreground">Transfer:</span>{' '}
                    <a href={`/purchase-orders/internal/${row.transferId}`} className="font-mono text-primary hover:underline">{row.ibtNumber}</a> ·{' '}
                    <span className="text-muted-foreground">Nota:</span> <span className="font-mono">{row.saleTrxNumber}</span>
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    <span className="text-muted-foreground">Alasan:</span> {INTERNAL_REASON_LABELS[row.reason] ?? row.reason} — {row.notes}
                  </p>
                  <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                    <InternalReturnItems row={row} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      Diajukan {formatDateTimeWib(row.requestedAt)}
                    </span>
                    <span>Oleh: {row.requestedByName} ({row.requestBranchName})</span>
                    {row.resolvedAt && <span>Diproses {formatDateTimeWib(row.resolvedAt)} oleh {row.resolvedByName ?? '-'}</span>}
                  </div>
                  <div className="mt-1"><InternalReturnOutcome row={row} /></div>
                  {row.status === 'REJECTED' && row.rejectionReason && (
                    <p className="mt-1 text-xs text-destructive">Ditolak: {row.rejectionReason}</p>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <a
                    href={`/purchase-orders/internal-returns/${row.id}/cetak`}
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
                        onClick={() => { setApproving(row); setActionError(null) }}
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

      {approving && split && (
        <RequiredChoiceDialog
          title={`Setujui Retur Internal ${approving.returnNumber}?`}
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setApproving(null), variant: 'secondary', disabled: actionLoading },
            { label: actionLoading ? 'Memproses...' : 'Ya, Setujui Retur', onClick: handleApprove, variant: 'primary', disabled: actionLoading },
          ]}
        >
          <p>Begitu disetujui, ini yang langsung terjadi:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Stok {approving.items.length} barang <b>keluar</b> dari <b>{approving.receiverBranchName}</b> dan{' '}
              <b>masuk lagi</b> ke <b>{approving.senderBranchName}</b> (stok bagus).
            </li>
            <li>
              Nota Bulk Sale <span className="font-mono">{approving.saleTrxNumber}</span> milik {approving.senderBranchName}{' '}
              dicatat diretur untuk barang ini — penjualan {approving.senderBranchName} ikut turun.
            </li>
            {split.payableDeduction > 0 && (
              <li>Hutang internal <span className="font-mono">{approving.ibtNumber}</span> dipotong <b>{formatRupiah(split.payableDeduction)}</b>.</li>
            )}
            {split.creditAmount > 0 && (
              <li>
                {split.payableDeduction > 0 ? 'Sisanya' : 'Hutang kiriman ini sudah lunas —'} <b>{formatRupiah(split.creditAmount)}</b> menjadi{' '}
                <b>Saldo Internal</b> {approving.receiverBranchName} di {approving.senderBranchName} — otomatis memotong
                tagihan internal terbuka yang paling lama (bila ada), atau tagihan berikutnya. Bukan uang kas.
              </li>
            )}
          </ul>
          <div className="rounded-md border border-border p-3">
            <InternalReturnItems row={approving} />
          </div>
          <p className="text-muted-foreground">
            Ditolak otomatis bila stok barangnya di {approving.receiverBranchName} tidak cukup. Bila ternyata salah,
            Owner/GM bisa <b>membatalkan</b> retur ini dari menu Retur Internal.
          </p>
          {actionError && (
            <div role="alert" className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">{actionError}</div>
          )}
        </RequiredChoiceDialog>
      )}

      {approving && isPriceRevision(approving) && (
        <PriceRevisionApproveDialog
          row={approving}
          onClose={() => setApproving(null)}
          onApproved={(message) => {
            setSuccessMsg(message)
            setApproving(null)
            load()
            onChanged()
          }}
        />
      )}

      {rejecting && (
        <RequiredChoiceDialog
          title={`Tolak ${isPriceRevision(rejecting) ? 'Revisi Harga Beli' : 'Retur Internal'} ${rejecting.returnNumber}?`}
          actions={[
            { label: 'Batal', onClick: () => setRejecting(null), variant: 'secondary', disabled: actionLoading },
            { label: actionLoading ? 'Memproses...' : 'Tolak Pengajuan', onClick: handleReject, variant: 'destructive', disabled: actionLoading },
          ]}
        >
          <p className="text-muted-foreground">
            {isPriceRevision(rejecting) ? 'Harga, modal' : 'Stok'} dan hutang internal tidak berubah.
          </p>
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
