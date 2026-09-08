'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCartStore, calcGrandTotal, calcItemCount } from './cart-store'
import {
  buildCartPreviewText,
  buildPreviewFileName,
  formatQty,
  formatRupiahPlain,
} from './cart-preview-text'
import { downloadBlob, renderCartPreviewPng } from './cart-preview-image'
import { useShortcutLock } from './shortcut-lock'

interface CartPreviewModalProps {
  storeName: string
  storePhone: string | null
  onClose: () => void
}

/**
 * Isi keranjang dalam satu lembar utuh untuk di-screenshot/difoto lalu dikirim ke
 * pelanggan — terutama reseller yang minta rincian sebelum memutuskan.
 *
 * Warnanya sengaja dikunci terang (`bg-white text-slate-900`, bukan token tema):
 * lembar ini berakhir sebagai gambar di WhatsApp, dan screenshot mode gelap susah
 * dibaca di layar ponsel yang terang.
 */
export default function CartPreviewModal({
  storeName,
  storePhone,
  onClose,
}: CartPreviewModalProps) {
  useShortcutLock()

  const items = useCartStore((s) => s.items)
  const selectedCustomer = useCartStore((s) => s.selectedCustomer)
  const [showPrices, setShowPrices] = useState(true)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  // Waktu dibekukan saat preview dibuka supaya angka di lembar tidak berubah
  // di antara dua kali screenshot.
  const [openedAt] = useState(() => new Date())
  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(openedAt),
    [openedAt]
  )

  const grandTotal = calcGrandTotal(items)
  const totalQty = calcItemCount(items)
  const twoColumns = items.length > 12

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSaveImage = async () => {
    if (items.length === 0 || saving) return
    setSaving(true)
    try {
      const blob = await renderCartPreviewPng(items, {
        storeName,
        storePhone,
        dateLabel,
        customerName: selectedCustomer?.name ?? null,
        showPrices,
      })
      if (!blob) {
        alert('Gambar gagal dibuat di perangkat ini. Screenshot lembar preview saja.')
        return
      }
      const fileName = buildPreviewFileName({
        storeName,
        customerName: selectedCustomer?.name ?? null,
        at: openedAt,
      })
      downloadBlob(blob, `${fileName}.png`)
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    const text = buildCartPreviewText(items, {
      storeName,
      dateLabel,
      customerName: selectedCustomer?.name ?? null,
      storePhone,
      showPrices,
    })

    // Sebagian stasiun POS dibuka lewat http di jaringan toko, dan di sana
    // `navigator.clipboard` tidak tersedia sama sekali.
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }

    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      alert('Tidak bisa menyalin otomatis di perangkat ini. Screenshot lembar preview saja.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        {/* Panel tombol — sengaja di luar lembar putih supaya gampang dipotong dari screenshot */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            aria-label="Tutup preview keranjang"
          >
            ✕ Tutup <kbd className="ml-1 font-mono text-xs font-normal opacity-60">Esc</kbd>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            {copied ? '✓ Tersalin' : 'Salin Teks'}
          </button>
          <button
            type="button"
            onClick={handleSaveImage}
            disabled={saving}
            className="min-h-[44px] rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
            title="Simpan lembar ini sebagai berkas gambar PNG"
          >
            {saving ? 'Menyiapkan…' : 'Simpan Gambar'}
          </button>
          <button
            type="button"
            onClick={() => setShowPrices((v) => !v)}
            className="min-h-[44px] rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            aria-pressed={!showPrices}
          >
            {showPrices ? 'Sembunyikan Harga' : 'Tampilkan Harga'}
          </button>
          <span className="ml-auto hidden text-xs text-white/60 sm:block">
            Screenshot bagian putih di bawah ini
          </span>
        </div>

        {/* Lembar yang di-screenshot */}
        <div className="rounded-xl bg-white p-5 text-slate-900 shadow-2xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-tight">{storeName}</p>
              {storePhone && <p className="text-sm text-slate-500">{storePhone}</p>}
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-slate-700">Rincian Pesanan</p>
              <p className="text-slate-500">{dateLabel}</p>
              {selectedCustomer && (
                <p className="mt-0.5 font-medium text-slate-700">{selectedCustomer.name}</p>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Keranjang masih kosong.</p>
          ) : (
            <ol className={`mt-3 ${twoColumns ? 'md:columns-2 md:gap-8' : ''}`}>
              {items.map((item, idx) => (
                <li
                  key={`${item.productId}_${item.uomId}_${item.priceTier}`}
                  className="flex break-inside-avoid gap-2 border-b border-slate-100 py-2 last:border-b-0"
                >
                  <span className="w-6 flex-shrink-0 text-sm tabular-nums text-slate-400">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{item.productName}</p>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        {formatQty(item.qty)} {item.uomCode}
                        {showPrices && <> × {formatRupiahPlain(item.unitPrice)}</>}
                      </span>
                      {showPrices && (
                        <span className="text-sm font-bold tabular-nums">
                          {formatRupiahPlain(item.subtotal)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {items.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t-2 border-slate-900 pt-3">
              <span className="text-sm text-slate-500">
                {items.length} produk · {formatQty(totalQty)} qty
              </span>
              {showPrices && (
                <span className="text-xl font-extrabold tabular-nums">
                  {formatRupiahPlain(grandTotal)}
                </span>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">Harga dapat berubah sewaktu-waktu.</p>
        </div>
      </div>
    </div>
  )
}
