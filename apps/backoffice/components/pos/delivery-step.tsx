'use client'

import { useEffect, useRef, useState } from 'react'
import { useShortcutLock } from './shortcut-lock'
import { NewBadge } from '@/components/ui/new-badge'
import { formatRupiah } from './cart-store'
import { TRUCK_NEEDS_CUSTOMER_MESSAGE } from '@/lib/delivery-method'
import type { PosDeliveryOptions } from '@/app/api/pos/delivery-options/route'
import {
  ONGKIR_QUICK_AMOUNTS,
  ongkirAmountProblem,
  ongkirUnitPrice,
  buildOngkirCartItem,
  type DeliveryChoice,
} from './delivery-step-model'
import type { CartItem } from './cart-store'

/**
 * Langkah Pengiriman (tab Kasir), dibuka sebelum layar bayar. Kasir wajib menjawab:
 * 1 Ambil sendiri · 2 Kurir cabang (pengantar + ongkir / Gratis ongkir) · 3 Truk Gudang (gratis ongkir).
 * Ongkos kirim hanya lahir di sini, jadi tidak bisa terlupa.
 */
export default function DeliveryStep({
  hasCustomer,
  customerTier,
  initial,
  legacyOngkirInCart,
  onConfirm,
  onClose,
}: {
  hasCustomer: boolean
  customerTier: string
  initial: DeliveryChoice | null
  /** Keranjang masih berisi baris Ongkos Kirim cara lama (mis. dari daftar tunggu). */
  legacyOngkirInCart: boolean
  /** `ongkirLine` = baris ongkir yang ditambahkan ke nota (hanya kurir cabang). */
  onConfirm: (choice: DeliveryChoice, ongkirLine: CartItem | null) => void
  onClose: () => void
}) {
  useShortcutLock()
  const [options, setOptions] = useState<PosDeliveryOptions | null>(null)
  const [loadError, setLoadError] = useState('')
  const [courierMode, setCourierMode] = useState(initial?.method === 'BRANCH_COURIER')
  const [courierId, setCourierId] = useState(initial?.method === 'BRANCH_COURIER' ? String(initial.courierId) : '')
  const [amountText, setAmountText] = useState(
    initial?.method === 'BRANCH_COURIER' && !initial.free ? String(initial.amount) : '',
  )
  const [free, setFree] = useState(initial?.method === 'BRANCH_COURIER' ? initial.free : false)
  const [error, setError] = useState('')
  const courierSelectRef = useRef<HTMLSelectElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Pindahkan kursor ke langkah ini saat dibuka (biasanya kursor masih di kotak cari produk),
  // supaya ketikan tidak masuk ke layar di belakang.
  useEffect(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement && !dialogRef.current?.contains(active)) active.blur()
    if (!courierSelectRef.current) dialogRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/pos/delivery-options')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Gagal memuat pilihan pengiriman')
        if (!cancelled) setOptions(data as PosDeliveryOptions)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Gagal memuat pilihan pengiriman')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const truckVisible = options?.truckEnabled !== false
  const unit = options?.ongkir ? ongkirUnitPrice(options.ongkir, customerTier) : null
  const amount = Number(amountText.replace(/\D/g, '')) || 0

  function choosePickup() {
    onConfirm({ method: 'PICKUP' }, null)
  }

  function chooseTruck() {
    if (!hasCustomer) {
      setError(TRUCK_NEEDS_CUSTOMER_MESSAGE)
      return
    }
    onConfirm({ method: 'TRUCK' }, null)
  }

  function openCourier() {
    setError('')
    setCourierMode(true)
    setTimeout(() => courierSelectRef.current?.focus(), 0)
  }

  function confirmCourier() {
    if (!options) return
    if (!options.ongkir || !unit) {
      setError('Produk Ongkos Kirim belum ada atau belum berharga di cabang ini. Minta Owner/GM mengisinya.')
      return
    }
    const courier = options.couriers.find((c) => String(c.id) === courierId)
    if (!courier) {
      setError('Pilih siapa yang mengantar.')
      return
    }
    if (!free) {
      const problem = ongkirAmountProblem(amount, unit.price)
      if (problem) {
        setError(problem)
        return
      }
    }
    const choice = { method: 'BRANCH_COURIER' as const, courierId: courier.id, courierName: courier.name, amount: free ? 0 : amount, free }
    try {
      onConfirm(choice, buildOngkirCartItem(options.ongkir, customerTier, choice, options.freeShippingValue))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ongkos kirim tidak bisa dibuat')
    }
  }

  // Keyboard: 1 / 2 / 3 memilih, Enter melanjutkan kurir, Esc menutup.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (!options || legacyOngkirInCart) return
      // Yang dihitung "sedang mengetik" hanya kolom DI DALAM langkah ini. Kursor yang tertinggal
      // di kotak cari produk di belakang tidak boleh menelan 1/2/3 (dan angkanya tidak boleh
      // ikut masuk ke kotak itu).
      const target = e.target instanceof Node ? e.target : null
      const insideDialog = Boolean(target && dialogRef.current?.contains(target))
      const typing =
        insideDialog &&
        (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement)
      if (e.key === 'Enter' && courierMode) {
        e.preventDefault()
        confirmCourier()
        return
      }
      if (typing) return
      if (e.key === '1') { e.preventDefault(); choosePickup() }
      else if (e.key === '2') { e.preventDefault(); openCourier() }
      else if (e.key === '3' && truckVisible) { e.preventDefault(); chooseTruck() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const card = (active: boolean, disabled = false) =>
    [
      'flex-1 rounded-xl border-2 px-3 py-3 text-left transition-colors min-h-[84px]',
      active ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50',
      disabled ? 'opacity-50' : '',
    ].join(' ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Pengiriman">
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-xl outline-none">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            Barang ini bagaimana sampainya? <NewBadge feature="fitur/langkah-pengiriman" />
          </h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent">
            Esc
          </button>
        </div>

        {legacyOngkirInCart ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Keranjang masih berisi baris <b>Ongkos kirim</b> cara lama. Hapus baris itu dari keranjang dulu — ongkos kirim kini
            diisi di langkah ini.
          </p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !options ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <>
            <div className="flex gap-2">
              <button type="button" onClick={choosePickup} className={card(initial?.method === 'PICKUP' && !courierMode)}>
                <span className="block text-xs text-muted-foreground">1</span>
                <span className="block text-sm font-bold">Ambil sendiri</span>
                <span className="block text-[11px] text-muted-foreground">Dibawa / dijemput pembeli</span>
              </button>
              <button type="button" onClick={openCourier} className={card(courierMode)}>
                <span className="block text-xs text-muted-foreground">2</span>
                <span className="block text-sm font-bold">Dikirim kurir cabang</span>
                <span className="block text-[11px] text-muted-foreground">Pilih pengantar &amp; ongkir</span>
              </button>
              {truckVisible && (
                <button type="button" onClick={chooseTruck} className={card(initial?.method === 'TRUCK' && !courierMode, !hasCustomer)}>
                  <span className="block text-xs text-muted-foreground">3</span>
                  <span className="block text-sm font-bold">Dikirim truk Gudang</span>
                  <span className="block text-[11px] text-muted-foreground">Gratis ongkir · nota berpelanggan</span>
                </button>
              )}
            </div>

            {courierMode && (
              <div className="mt-4 space-y-3 rounded-xl border border-sky-300 bg-sky-50 px-3 py-3 dark:border-sky-800 dark:bg-sky-950/30">
                <div>
                  <label htmlFor="delivery-courier" className="mb-1 block text-xs font-semibold">Diantar siapa? *</label>
                  {options.couriers.length === 0 ? (
                    <p className="text-xs font-medium text-destructive">
                      Belum ada pengantar terdaftar. Minta Owner/GM menambahkannya di Back Office → Pengaturan → Groomer &amp; Pengantar.
                    </p>
                  ) : (
                    <select
                      id="delivery-courier"
                      ref={courierSelectRef}
                      value={courierId}
                      onChange={(e) => setCourierId(e.target.value)}
                      className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      <option value="">-- Pilih pengantar --</option>
                      {options.couriers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold">Ongkos kirim *</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {ONGKIR_QUICK_AMOUNTS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={free}
                        onClick={() => setAmountText(String(v))}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
                          !free && amount === v ? 'border-primary bg-primary/10' : 'border-border bg-background'
                        }`}
                      >
                        {formatRupiah(String(v))}
                      </button>
                    ))}
                    <input
                      inputMode="numeric"
                      disabled={free}
                      value={free ? '' : amountText}
                      onChange={(e) => setAmountText(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ketik nilai lain"
                      aria-label="Nilai ongkos kirim"
                      className="w-36 min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-40"
                    />
                  </div>
                  <label className="mt-2 flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="mt-0.5 h-4 w-4" />
                    <span>
                      <b>Gratis ongkir</b> (ditanggung toko) — tercatat {formatRupiah(String(options.freeShippingValue))}, tidak ditagih ke
                      pelanggan; pengantar tidak dapat bonus.
                    </span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={confirmCourier}
                  className="w-full min-h-[44px] rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90"
                >
                  Lanjut ke Pembayaran (Enter)
                </button>
              </div>
            )}

            {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
            <p className="mt-3 text-[11px] text-muted-foreground">Tekan 1, 2{truckVisible ? ', atau 3' : ''} untuk memilih cepat.</p>
          </>
        )}
      </div>
    </div>
  )
}
