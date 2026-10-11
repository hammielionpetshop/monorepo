'use client'

import { useState } from 'react'
import { Ban, Undo2 } from 'lucide-react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { formatRupiah } from '@/components/supplier-returns/types'
import type { InternalReturnView } from './types'

export interface InternalReturnActionsConfig {
  /** Basis API: `/api/bo/internal-returns` atau `/api/pos/internal-returns`. */
  apiBase: string
  /** User yang sedang login — hanya pengaju yang melihat tombol Tarik. */
  userId: number
  /** OWNER/GM (izin penyetuju) — boleh membatalkan retur yang sudah disetujui. */
  canCancel: boolean
  onChanged: (message: string) => void
}

/**
 * Tombol pada satu baris retur internal: "Tarik pengajuan" (pengaju, selama menunggu) dan
 * "Batalkan retur" (OWNER/GM, retur yang sudah disetujui). Keduanya lewat popup wajib pilih.
 */
export function InternalReturnActions({ row, config }: { row: InternalReturnView; config: InternalReturnActionsConfig }) {
  const [dialog, setDialog] = useState<'withdraw' | 'cancel' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canWithdraw = row.status === 'PENDING' && row.requestedById === config.userId
  const canCancel = row.status === 'APPROVED' && config.canCancel
  if (!canWithdraw && !canCancel) return null

  function close() {
    setDialog(null)
    setReason('')
    setError('')
  }

  async function submit(kind: 'withdraw' | 'cancel') {
    if (kind === 'cancel' && reason.trim().length < 5) {
      setError('Tulis alasan pembatalan (minimal 5 huruf)')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`${config.apiBase}/${row.id}/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(kind === 'cancel' ? { reason: reason.trim() } : {}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Gagal memproses, coba lagi')
        return
      }
      close()
      config.onChanged(
        kind === 'cancel'
          ? `Retur ${row.returnNumber} dibatalkan — stok kembali ke ${row.receiverBranchName}, potongan hutang & saldo internal dibalik.`
          : `Pengajuan ${row.returnNumber} ditarik.`,
      )
    } catch {
      setError('Koneksi gagal, coba lagi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {canWithdraw && (
        <button
          type="button"
          onClick={() => setDialog('withdraw')}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
        >
          <Undo2 className="h-3.5 w-3.5" /> Tarik pengajuan
        </button>
      )}
      {canCancel && (
        <button
          type="button"
          onClick={() => setDialog('cancel')}
          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
        >
          <Ban className="h-3.5 w-3.5" /> Batalkan retur
        </button>
      )}

      {dialog === 'withdraw' && (
        <RequiredChoiceDialog
          title={`Tarik pengajuan ${row.returnNumber}?`}
          tone="warning"
          actions={[
            { label: 'Kembali', onClick: close, disabled: busy },
            { label: busy ? 'Memproses...' : 'Ya, tarik pengajuan', onClick: () => submit('withdraw'), variant: 'primary', disabled: busy },
          ]}
        >
          <p>Pengajuan ini batal diajukan dan tidak akan muncul di antrean persetujuan. Stok dan hutang internal tidak berubah.</p>
          <p className="text-muted-foreground">Dokumennya tetap tercatat dengan status <b>Ditarik</b>.</p>
          {error && <p className="text-destructive">{error}</p>}
        </RequiredChoiceDialog>
      )}

      {dialog === 'cancel' && (
        <RequiredChoiceDialog
          title={`Batalkan retur ${row.returnNumber}?`}
          tone="danger"
          actions={[
            { label: 'Kembali', onClick: close, disabled: busy },
            { label: busy ? 'Memproses...' : 'Ya, batalkan retur', onClick: () => submit('cancel'), variant: 'destructive', disabled: busy },
          ]}
        >
          <p>Semua akibat persetujuan retur ini akan dibalik:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Stok {row.items.length} barang <b>keluar lagi</b> dari {row.senderBranchName} dan <b>masuk lagi</b> ke{' '}
              {row.receiverBranchName}. Ditolak bila stok di {row.senderBranchName} sudah tidak cukup.
            </li>
            <li>Nota Bulk Sale <span className="font-mono">{row.saleTrxNumber}</span> kembali ke nilai semula.</li>
            {row.payableDeduction > 0 && (
              <li>Potongan hutang internal <b>{formatRupiah(row.payableDeduction)}</b> dibatalkan — hutang kembali.</li>
            )}
            {row.creditAmount > 0 && (
              <li>Saldo Internal dikurangi <b>{formatRupiah(row.creditAmount)}</b>. Ditolak bila saldo itu sudah terpakai.</li>
            )}
          </ul>
          <p className="text-muted-foreground">Dokumen tidak dihapus — statusnya menjadi <b>Dibatalkan</b>.</p>
          <label className="block pt-1">
            <span className="text-xs font-medium">Alasan pembatalan (wajib)</span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          {error && <p className="text-destructive">{error}</p>}
        </RequiredChoiceDialog>
      )}
    </>
  )
}
