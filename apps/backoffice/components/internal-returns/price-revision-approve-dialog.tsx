'use client'

import { useEffect, useMemo, useState } from 'react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { formatRupiah } from '@/components/supplier-returns/types'
import { estimatePriceRevisionLine } from '@/lib/internal-price-revision-math'
import { formatQty, revisionValueLabel, type InternalReturnView, type PriceRevisionPreview } from './types'

/**
 * Popup penyetuju Revisi Harga Beli (Owner/GM): harga lama, harga usulan pemohon, dan kolom harga
 * final yang boleh diubah. Wajib memperlihatkan berapa barang yang sudah terjual / terpakai dan
 * berapa modalnya dikoreksi (keputusan owner 2026-10-11) sebelum tombol setuju ditekan.
 */
export function PriceRevisionApproveDialog({
  row,
  onClose,
  onApproved,
}: {
  row: InternalReturnView
  onClose: () => void
  onApproved: (message: string) => void
}) {
  const [preview, setPreview] = useState<PriceRevisionPreview | null>(null)
  const [finals, setFinals] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/bo/internal-returns/${row.id}/preview`)
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) return setError(data.error ?? 'Gagal menghitung pratinjau revisi harga')
        const loaded = data as PriceRevisionPreview
        setPreview(loaded)
        setFinals(Object.fromEntries(loaded.items.map(it => [it.itemId, String(it.proposedUnitPrice)])))
      } catch {
        if (!cancelled) setError('Koneksi gagal saat menghitung pratinjau. Tutup lalu coba lagi.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row.id])

  const lines = useMemo(
    () =>
      (preview?.items ?? []).map(it => {
        const view = row.items.find(v => v.id === it.itemId)
        const finalUnitPrice = Number((finals[it.itemId] ?? '').trim())
        const valid = Number.isInteger(finalUnitPrice) && finalUnitPrice > 0
        const estimate = valid
          ? estimatePriceRevisionLine({ qty: it.qty, ratio: it.ratio, oldUnitPrice: it.currentUnitPrice, finalUnitPrice, remainingBase: it.remainingBase })
          : null
        return { it, view, finalUnitPrice, valid, estimate }
      }),
    [preview, finals, row.items],
  )

  const total = lines.reduce((sum, l) => sum + (l.estimate?.lineValue ?? 0), 0)
  const totalCogsAdjustment = lines.reduce((sum, l) => sum + (l.estimate?.cogsAdjustment ?? 0), 0)
  const payableRemaining = row.payableRemaining ?? 0
  const deduction = Math.max(0, Math.min(total, payableRemaining))
  const credit = Math.max(0, total - deduction)

  function problem(): string | null {
    if (!preview) return 'Pratinjau belum selesai dihitung'
    for (const l of lines) {
      const name = l.view?.productName ?? 'barang'
      if (l.it.qty <= 0) return `${name} dari kiriman ini sudah habis dikembalikan — tolak pengajuan ini`
      if (!l.valid) return `Harga final ${name} harus angka bulat lebih dari 0`
      if (l.finalUnitPrice === l.it.currentUnitPrice) return `Harga final ${name} sama dengan harga sekarang — tolak pengajuan ini bila harganya sudah benar`
    }
    return null
  }

  async function approve() {
    const issue = problem()
    if (issue) return setError(issue)
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/bo/internal-returns/${row.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalPrices: lines.map(l => ({ itemId: l.it.itemId, finalUnitPrice: l.finalUnitPrice })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Gagal menyetujui revisi harga beli')
      const r = data.data ?? {}
      onApproved(
        `Revisi harga ${row.returnNumber} disetujui — tagihan internal ${row.ibtNumber} ${revisionValueLabel(r.totalValue ?? total)}` +
          (r.payableDeduction > 0 ? `, hutang dipotong ${formatRupiah(r.payableDeduction)}` : '') +
          (r.creditAmount > 0 ? `, ${formatRupiah(r.creditAmount)} masuk Saldo Internal` : '') +
          (r.cogsAdjustment ? `, modal barang yang sudah terjual dikoreksi ${revisionValueLabel(r.cogsAdjustment)}` : '') +
          '.',
      )
    } catch {
      setError('Koneksi gagal, coba lagi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <RequiredChoiceDialog
      title={`Setujui Revisi Harga Beli ${row.returnNumber}?`}
      tone="warning"
      actions={[
        { label: 'Batal', onClick: onClose, variant: 'secondary', disabled: busy },
        { label: busy ? 'Memproses...' : 'Ya, Setujui Revisi', onClick: approve, variant: 'primary', disabled: busy || !preview },
      ]}
    >
      <p>
        Kiriman <span className="font-mono">{row.ibtNumber}</span> dari <b>{row.senderBranchName}</b> ke{' '}
        <b>{row.receiverBranchName}</b>. Stok <b>tidak bergeser</b> — hanya harga yang dibetulkan. Harga final boleh Anda ubah.
      </p>

      {!preview && !error && <p className="text-muted-foreground">Menghitung pratinjau…</p>}

      {preview && (
        <div className="max-h-[45vh] space-y-2 overflow-y-auto">
          {lines.map(({ it, view, estimate }) => {
            const consumedUom = estimate ? estimate.qtyConsumedBase / it.ratio : 0
            const remainingUom = estimate ? Math.min(estimate.qtyBase, it.remainingBase) / it.ratio : 0
            const uom = view?.uomCode ?? ''
            return (
              <div key={it.itemId} className="rounded-md border border-border p-3 space-y-1.5">
                <p className="text-sm font-semibold text-foreground">{view?.productName ?? `Barang #${it.itemId}`}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Harga lama</p>
                    <p className="font-medium text-foreground">{formatRupiah(it.currentUnitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Usulan pemohon</p>
                    <p className="font-medium text-foreground">{formatRupiah(it.proposedUnitPrice)}</p>
                  </div>
                  <label className="block">
                    <span className="text-muted-foreground">Harga final /{uom}</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={finals[it.itemId] ?? ''}
                      onChange={e => { setError(''); setFinals(prev => ({ ...prev, [it.itemId]: e.target.value })) }}
                      disabled={busy}
                      className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      aria-label={`Harga final ${view?.productName ?? ''}`}
                    />
                  </label>
                </div>
                {it.qty <= 0 ? (
                  <p className="text-xs text-destructive">Barang ini sudah habis dikembalikan — tidak ada yang direvisi.</p>
                ) : estimate ? (
                  <>
                    <p className="text-xs text-foreground">
                      {formatQty(it.qty)} {uom} × selisih → tagihan <b>{revisionValueLabel(estimate.lineValue)}</b>
                    </p>
                    <p className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-400">
                      {estimate.qtyConsumedBase === 0 && estimate.cogsAdjustment === 0 ? (
                        <>Belum ada yang terjual — {formatQty(it.qty)} {uom} masih di stok, modalnya diganti ke harga final</>
                      ) : (
                        <>
                          {formatQty(consumedUom)} dari {formatQty(it.qty)} {uom} sudah terjual / terpakai — modal dikoreksi{' '}
                          {revisionValueLabel(estimate.cogsAdjustment)}
                          {remainingUom > 0 && <> · sisa {formatQty(remainingUom)} {uom} di stok: modalnya diganti ke harga final</>}
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-destructive">Isi harga final dengan angka bulat lebih dari 0.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <>
          <p>Begitu disetujui, ini yang langsung terjadi:</p>
          <ul className="list-disc space-y-1 pl-5">
            {total >= 0 ? (
              <>
                <li>
                  Tagihan internal <span className="font-mono">{row.ibtNumber}</span> <b>{revisionValueLabel(total)}</b>
                  {deduction > 0 && <> — hutang dipotong <b>{formatRupiah(deduction)}</b></>}
                  {credit > 0 && (
                    <>
                      {' '}— <b>{formatRupiah(credit)}</b> menjadi <b>Saldo Internal</b> {row.receiverBranchName} di {row.senderBranchName}{' '}
                      (otomatis memotong tagihan internal lain; bukan uang kas)
                    </>
                  )}
                  .
                </li>
              </>
            ) : (
              <li>
                Harga <b>naik</b>: tagihan internal <span className="font-mono">{row.ibtNumber}</span> <b>bertambah {formatRupiah(-total)}</b>{' '}
                (hutang {row.receiverBranchName} ke {row.senderBranchName}).
              </li>
            )}
            <li>
              Penjualan {row.senderBranchName} di Laba Rugi dikoreksi <b>{revisionValueLabel(total)}</b> pada tanggal hari ini (nota{' '}
              <span className="font-mono">{row.saleTrxNumber}</span> sendiri tidak diubah).
            </li>
            <li>
              Modal barang yang <b>sudah terjual / terpakai</b> di {row.receiverBranchName} dikoreksi{' '}
              <b>{revisionValueLabel(totalCogsAdjustment)}</b> — tampil sebagai &quot;Penyesuaian Modal (Revisi Harga Beli)&quot; di Laba Rugi.
              Stok yang masih ada langsung memakai harga final.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Angka di atas perkiraan dari keadaan stok saat ini; angka pasti dihitung saat tombol setuju ditekan. Bila ternyata
            salah, Owner/GM bisa <b>membatalkan</b> revisi dari menu Retur Internal (selama stoknya belum berubah) atau membuat
            revisi baru.
          </p>
        </>
      )}

      {error && (
        <div role="alert" className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">{error}</div>
      )}
    </RequiredChoiceDialog>
  )
}
