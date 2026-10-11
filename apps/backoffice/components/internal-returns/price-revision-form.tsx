'use client'

import { useMemo, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { formatDateWib, formatRupiah } from '@/components/supplier-returns/types'
import { INTERNAL_KIND_PRICE, revisionValueLabel, type RevisableTransfer } from './types'

/**
 * Form pengajuan Retur Internal "Revisi Harga Beli" — dipakai POS dan Back Office. Kode transaksi
 * asal wajib dicari dulu; pemohon mengisi harga yang benar hanya pada barang yang harganya salah.
 * Stok tidak bergeser. Pengajuan masuk sebagai PENDING: modal & hutang internal baru berubah
 * setelah disetujui Owner/GM (yang masih boleh mengubah harganya) di Permintaan Persetujuan.
 */
export function PriceRevisionForm({
  apiBase,
  onSubmitted,
}: {
  /** `/api/pos/internal-returns` atau `/api/bo/internal-returns`. */
  apiBase: string
  onSubmitted: (returnNumber: string) => void
}) {
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<RevisableTransfer | null>(null)

  /** Harga yang benar per baris kiriman (teks isian); kosong = barang itu tidak direvisi. */
  const [prices, setPrices] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function lookup() {
    const key = code.trim()
    if (!key) return setError('Ketik nomor transfer (IBT) atau nomor nota Bulk Sale dulu')
    setSearching(true)
    setError('')
    setFound(null)
    setPrices({})
    try {
      const res = await fetch(`${apiBase}/lookup?kind=${INTERNAL_KIND_PRICE}&code=${encodeURIComponent(key)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Kode transaksi tidak ditemukan')
      setFound(data as RevisableTransfer)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setSearching(false)
    }
  }

  function reset() {
    setFound(null)
    setPrices({})
    setCode('')
    setNotes('')
    setError('')
  }

  const lines = useMemo(
    () =>
      (found?.items ?? []).flatMap(item => {
        const text = (prices[item.id] ?? '').trim()
        if (!text) return []
        const proposed = Number(text)
        return [{ item, proposed, lineValue: (item.unitPrice - proposed) * item.revisableQty }]
      }),
    [found, prices],
  )
  const total = lines.reduce((sum, l) => sum + l.lineValue, 0)
  const payableRemaining = found?.payable ? Math.max(0, found.payable.totalAmount - found.payable.paidAmount) : 0
  const deduction = Math.max(0, Math.min(total, payableRemaining))
  const credit = Math.max(0, total - deduction)

  function validate(): string | null {
    if (!found) return 'Cari kode transaksi asal dulu'
    if (lines.length === 0) return 'Isi harga yang benar pada minimal satu barang'
    for (const { item, proposed } of lines) {
      if (!Number.isInteger(proposed) || proposed <= 0) return `Harga yang benar untuk ${item.productName} harus angka bulat lebih dari 0`
      if (proposed === item.unitPrice) return `Harga yang benar untuk ${item.productName} sama dengan harga sekarang — kosongkan bila tidak direvisi`
    }
    if (notes.trim().length < 5) return 'Tulis penjelasan kenapa harganya salah (minimal 5 huruf)'
    return null
  }

  function openConfirm() {
    const problem = validate()
    if (problem) return setError(problem)
    setError('')
    setConfirmOpen(true)
  }

  async function submit() {
    if (!found) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: INTERNAL_KIND_PRICE,
          transferId: found.transfer.id,
          notes: notes.trim(),
          items: lines.map(l => ({ transferItemId: l.item.id, proposedUnitPrice: l.proposed })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      setConfirmOpen(false)
      if (!res.ok) return setError(data.error ?? 'Gagal mengajukan revisi harga beli')
      reset()
      onSubmitted(data.returnNumber ?? '')
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div>
        <label htmlFor="revisi-harga-kode" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Kode transaksi asal * (nomor transfer IBT atau nomor nota Bulk Sale)
        </label>
        <div className="flex gap-2">
          <input
            id="revisi-harga-kode"
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookup() } }}
            disabled={!!found}
            placeholder="Contoh: IBT-20261011-0001"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] disabled:opacity-60"
          />
          {found ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-accent min-h-[44px]"
            >
              Ganti kode
            </button>
          ) : (
            <button
              type="button"
              onClick={lookup}
              disabled={searching}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 min-h-[44px]"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Cari
            </button>
          )}
        </div>
        {!found && (
          <p className="mt-1 text-xs text-muted-foreground">
            Nomornya ada di surat jalan / daftar Transfer Internal. Tanpa kode ini revisi harga tidak bisa diajukan.
          </p>
        )}
      </div>

      {found && (
        <>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
            <p>
              Kiriman <b className="font-mono">{found.transfer.ibtNumber}</b> · nota <b className="font-mono">{found.sale.trxNumber}</b>
              {found.transfer.receivedAt && <> · diterima {formatDateWib(found.transfer.receivedAt)}</>}
            </p>
            <p className="mt-0.5">
              Dari <b>{found.transfer.senderBranchName}</b> ke <b>{found.transfer.receiverBranchName}</b> — stok{' '}
              <b>tidak bergeser</b>, hanya harganya yang dibetulkan.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {found.payable
                ? payableRemaining > 0
                  ? `Sisa hutang internal kiriman ini: ${formatRupiah(payableRemaining)}.`
                  : 'Hutang internal kiriman ini sudah lunas — bila harga turun, selisihnya menjadi Saldo Internal (otomatis memotong tagihan internal lain).'
                : 'Kiriman ini belum punya catatan hutang internal.'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Barang di kiriman ini — isi <b>harga yang benar</b> hanya pada barang yang harganya salah
            </p>
            <div className="rounded-lg border border-border divide-y divide-border">
              {found.items.map(item => {
                const blocked = item.hasPendingRevision
                  ? 'masih ada pengajuan revisi yang menunggu persetujuan'
                  : item.revisableQty <= 0
                    ? 'sudah habis dikembalikan'
                    : null
                const line = lines.find(l => l.item.id === item.id)
                return (
                  <div key={item.id} className={`flex flex-wrap items-center gap-2 px-3 py-2 ${blocked ? 'opacity-60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.revisableQty} {item.uomCode} · harga sekarang{' '}
                        <b className="text-foreground">{formatRupiah(item.unitPrice)}</b>/{item.uomCode}
                        {item.unitPrice !== item.notaUnitPrice && ` (sudah direvisi, harga nota ${formatRupiah(item.notaUnitPrice)})`}
                        {blocked && ` · ${blocked}`}
                      </p>
                      {line && Number.isFinite(line.lineValue) && line.lineValue !== 0 && (
                        <p className={`text-xs font-medium ${line.lineValue > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                          Tagihan {revisionValueLabel(line.lineValue)}
                        </p>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Harga yang benar
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={prices[item.id] ?? ''}
                        onChange={e => { setError(''); setPrices(prev => ({ ...prev, [item.id]: e.target.value })) }}
                        disabled={!!blocked}
                        placeholder="—"
                        className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[40px] disabled:opacity-60"
                        aria-label={`Harga yang benar ${item.productName} per ${item.uomCode}`}
                      />
                    </label>
                  </div>
                )
              })}
              {found.items.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Kiriman ini tidak punya barang.</p>}
            </div>
          </div>

          <div>
            <label htmlFor="revisi-harga-penjelasan" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Penjelasan * (wajib, untuk penyetuju)
            </label>
            <textarea
              id="revisi-harga-penjelasan"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Contoh: Gudang memakai harga retail, seharusnya harga grosir"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <p className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
            Revisi berlaku untuk <b>seluruh qty</b> barang itu di kiriman ini (dikurangi yang sudah dikembalikan). Nota lama
            tidak diubah — yang dibuat adalah dokumen revisi. Penyetuju boleh mengubah harga sebelum menyetujui.
          </p>

          {lines.length > 0 && Number.isFinite(total) && (
            <p className="text-sm text-foreground">
              Tagihan kiriman ini: <span className="font-semibold">{revisionValueLabel(total)}</span>
              <span className="text-muted-foreground">
                {deduction > 0 && ` · memotong hutang internal ${formatRupiah(deduction)}`}
                {credit > 0 && ` · jadi Saldo Internal ${formatRupiah(credit)}`}
              </span>
            </p>
          )}
        </>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive" role="alert">
          <X className="h-4 w-4 flex-shrink-0" /> {error}
        </p>
      )}

      {found && (
        <button
          type="button"
          onClick={openConfirm}
          disabled={submitting}
          className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 min-h-[48px]"
        >
          Ajukan Revisi Harga Beli
        </button>
      )}

      {confirmOpen && found && (
        <RequiredChoiceDialog
          title="Ajukan revisi harga beli?"
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setConfirmOpen(false), variant: 'secondary', disabled: submitting },
            { label: submitting ? 'Mengirim…' : 'Ya, Ajukan', onClick: submit, variant: 'primary', disabled: submitting },
          ]}
        >
          <p>
            Harga {lines.length} barang di kiriman <b>{found.transfer.ibtNumber}</b> ({found.transfer.senderBranchName} →{' '}
            {found.transfer.receiverBranchName}) diusulkan diubah. Tagihan kiriman ini <b>{revisionValueLabel(total)}</b>.
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {lines.map(l => (
              <li key={l.item.id}>
                {l.item.revisableQty} {l.item.uomCode} · {l.item.productName}: {formatRupiah(l.item.unitPrice)} →{' '}
                <b>{formatRupiah(l.proposed)}</b>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Pengajuan menunggu persetujuan Owner/GM. Modal barang dan hutang internal <b>belum berubah</b> sampai disetujui.
          </p>
        </RequiredChoiceDialog>
      )}
    </div>
  )
}
