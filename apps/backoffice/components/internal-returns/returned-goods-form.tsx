'use client'

import { useMemo, useState } from 'react'
import { Camera, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { formatDateWib, formatRupiah } from '@/components/supplier-returns/types'
import {
  INTERNAL_REASON_LABELS,
  RETURNED_GOODS_REASONS,
  type ReturnableTransfer,
  type ReturnedGoodsReason,
} from './types'

interface DraftItem {
  transferItemId: number
  productName: string
  uomCode: string
  maxQty: number
  unitPrice: number
  qty: number
  photoUrl: string | null
  uploadingPhoto?: boolean
}

/**
 * Form pengajuan Retur Internal "Barang Dikembalikan" — dipakai POS (kasir) dan Back Office.
 * Kode transaksi asal (nomor IBT / nota Bulk Sale) wajib dicari dulu; barang hanya bisa dipilih
 * dari kiriman itu. Pengajuan masuk sebagai PENDING: stok & hutang internal baru berubah setelah
 * disetujui Owner/GM di Permintaan Persetujuan.
 */
export function ReturnedGoodsForm({
  apiBase,
  onSubmitted,
}: {
  /** `/api/pos/internal-returns` atau `/api/bo/internal-returns`. */
  apiBase: string
  onSubmitted: (returnNumber: string) => void
}) {
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<ReturnableTransfer | null>(null)

  const [draft, setDraft] = useState<DraftItem[]>([])
  const [reason, setReason] = useState<ReturnedGoodsReason>('TIDAK_DATANG')
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
    setDraft([])
    try {
      const res = await fetch(`${apiBase}/lookup?code=${encodeURIComponent(key)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Kode transaksi tidak ditemukan')
      setFound(data as ReturnableTransfer)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setSearching(false)
    }
  }

  function reset() {
    setFound(null)
    setDraft([])
    setCode('')
    setNotes('')
    setReason('TIDAK_DATANG')
    setError('')
  }

  const addItem = (item: ReturnableTransfer['items'][number]) => {
    setError('')
    setDraft(prev => prev.some(d => d.transferItemId === item.id) ? prev : [...prev, {
      transferItemId: item.id,
      productName: item.productName,
      uomCode: item.uomCode,
      maxQty: item.returnableQty,
      unitPrice: item.unitPrice,
      qty: 1,
      photoUrl: null,
    }])
  }

  const updateItem = (transferItemId: number, patch: Partial<DraftItem>) =>
    setDraft(prev => prev.map(it => (it.transferItemId === transferItemId ? { ...it, ...patch } : it)))

  const removeItem = (transferItemId: number) => setDraft(prev => prev.filter(it => it.transferItemId !== transferItemId))

  const pickPhoto = (transferItemId: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      updateItem(transferItemId, { uploadingPhoto: true })
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/pos/uploads', { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.url) {
          setError(data.error ?? 'Gagal mengunggah foto')
          updateItem(transferItemId, { uploadingPhoto: false })
          return
        }
        updateItem(transferItemId, { photoUrl: data.url, uploadingPhoto: false })
      } catch {
        setError('Terjadi kesalahan jaringan saat unggah foto')
        updateItem(transferItemId, { uploadingPhoto: false })
      }
    }
    input.click()
  }

  const total = useMemo(() => draft.reduce((acc, it) => acc + it.unitPrice * it.qty, 0), [draft])
  const payableRemaining = found?.payable ? Math.max(0, found.payable.totalAmount - found.payable.paidAmount) : 0
  const deduction = Math.min(total, payableRemaining)
  const credit = total - deduction

  function validate(): string | null {
    if (!found) return 'Cari kode transaksi asal dulu'
    if (draft.length === 0) return 'Pilih minimal satu barang yang dikembalikan'
    for (const it of draft) {
      if (!Number.isInteger(it.qty) || it.qty <= 0) return `Qty ${it.productName} harus lebih dari 0`
      if (it.qty > it.maxQty) return `Qty ${it.productName} melebihi sisa yang bisa dikembalikan (${it.maxQty} ${it.uomCode})`
      if (it.uploadingPhoto) return 'Tunggu foto selesai diunggah'
    }
    if (notes.trim().length < 5) return 'Tulis penjelasan alasan retur (minimal 5 huruf)'
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
          transferId: found.transfer.id,
          reason,
          notes: notes.trim(),
          items: draft.map(it => ({ transferItemId: it.transferItemId, qty: it.qty, photoUrl: it.photoUrl })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      setConfirmOpen(false)
      if (!res.ok) return setError(data.error ?? 'Gagal mengajukan retur internal')
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
        <label htmlFor="retur-internal-kode" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Kode transaksi asal * (nomor transfer IBT atau nomor nota Bulk Sale)
        </label>
        <div className="flex gap-2">
          <input
            id="retur-internal-kode"
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
            Nomornya ada di surat jalan / daftar Transfer Internal. Tanpa kode ini retur internal tidak bisa diajukan.
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
              Dari <b>{found.transfer.senderBranchName}</b> ke <b>{found.transfer.receiverBranchName}</b> — barang yang
              dikembalikan masuk lagi ke stok <b>{found.transfer.senderBranchName}</b>.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {found.payable
                ? payableRemaining > 0
                  ? `Sisa hutang internal kiriman ini: ${formatRupiah(payableRemaining)}.`
                  : 'Hutang internal kiriman ini sudah lunas — nilai retur akan menjadi Saldo Internal.'
                : 'Kiriman ini belum punya catatan hutang internal.'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Barang di kiriman ini — klik yang dikembalikan</p>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {found.items.map(item => {
                const disabled = item.returnableQty <= 0 || draft.some(d => d.transferItemId === item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addItem(item)}
                    disabled={disabled}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Diterima {item.qtyReceived} {item.uomCode}
                        {item.alreadyReturned > 0 && ` · sudah/sedang diretur ${item.alreadyReturned}`}
                        {' · '}{formatRupiah(item.unitPrice)}/{item.uomCode}
                        {item.returnableQty <= 0 && ' · sudah habis dikembalikan'}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 flex-shrink-0 text-primary" />
                  </button>
                )
              })}
              {found.items.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Kiriman ini tidak punya barang.</p>}
            </div>
          </div>

          {draft.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Barang yang dikembalikan</p>
              {draft.map(it => (
                <div key={it.transferItemId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  {it.photoUrl ? (
                    <button type="button" onClick={() => updateItem(it.transferItemId, { photoUrl: null })} className="relative flex-shrink-0" aria-label={`Hapus foto ${it.productName}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.photoUrl} alt="" className="h-10 w-10 rounded-md object-cover border border-border" />
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white">
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pickPhoto(it.transferItemId)}
                      disabled={it.uploadingPhoto}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                      aria-label={`Tambah foto ${it.productName}`}
                      title="Foto bukti (tidak wajib)"
                    >
                      {it.uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{it.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRupiah(it.unitPrice)}/{it.uomCode} · maks {it.maxQty}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">{it.uomCode}</span>
                  <input
                    type="number"
                    min={1}
                    max={it.maxQty}
                    value={it.qty}
                    onChange={e => updateItem(it.transferItemId, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[40px]"
                    aria-label={`Qty ${it.productName}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.transferItemId)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Hapus barang"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Alasan *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {RETURNED_GOODS_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                    reason === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {INTERNAL_REASON_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="retur-internal-penjelasan" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Penjelasan * (wajib, untuk penyetuju)
            </label>
            <textarea
              id="retur-internal-penjelasan"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Contoh: di surat jalan 10 sak, yang datang 8 sak — 2 sak tidak ada di mobil"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <p className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
            Hanya untuk <b>stok bagus</b> yang kembali ke cabang pengirim (atau barang tercatat tapi tidak datang). Barang
            rusak dicatat di menu <b>Barang Rusak</b>. Barang yang datang tapi tidak dipesan dicatat lewat <b>PO baru</b>.
          </p>

          {draft.length > 0 && (
            <p className="text-sm text-foreground">
              Nilai retur: <span className="font-semibold">{formatRupiah(total)}</span>
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
          Ajukan Barang Dikembalikan
        </button>
      )}

      {confirmOpen && found && (
        <RequiredChoiceDialog
          title="Ajukan barang dikembalikan?"
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setConfirmOpen(false), variant: 'secondary', disabled: submitting },
            { label: submitting ? 'Mengirim…' : 'Ya, Ajukan', onClick: submit, variant: 'primary', disabled: submitting },
          ]}
        >
          <p>
            {draft.length} barang dari kiriman <b>{found.transfer.ibtNumber}</b> dikembalikan dari{' '}
            <b>{found.transfer.receiverBranchName}</b> ke <b>{found.transfer.senderBranchName}</b>, nilai{' '}
            <b>{formatRupiah(total)}</b>.
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {draft.map(it => <li key={it.transferItemId}>{it.qty} {it.uomCode} · {it.productName}</li>)}
          </ul>
          <p className="text-muted-foreground">
            Pengajuan menunggu persetujuan Owner/GM. Stok dan hutang internal <b>belum berubah</b> sampai disetujui.
          </p>
        </RequiredChoiceDialog>
      )}
    </div>
  )
}
