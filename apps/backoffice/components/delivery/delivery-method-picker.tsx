'use client'

import { useEffect, useState } from 'react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import {
  DELIVERY_CHANGE_DAYS,
  DELIVERY_REASON_MAX,
  SALE_DELIVERY_LABELS,
  SALE_DELIVERY_METHODS,
  TRANSFER_DELIVERY_LABELS,
  TRANSFER_DELIVERY_METHODS,
  saleDeliveryOrder,
  COURIER_NEEDS_ONGKIR_MESSAGE,
  type SaleDeliveryMethod,
  type TransferDeliveryMethod,
} from '@/lib/delivery-method'

const HINTS: Record<SaleDeliveryMethod, string> = {
  PICKUP: 'Toko ambil barang sendiri',
  BRANCH_COURIER: 'Diantar karyawan cabang (ongkir)',
  TRUCK: 'Dibawa driver Gudang',
}

function choiceClass(active: boolean, disabled: boolean) {
  return [
    'flex-1 rounded-lg border-2 px-3 py-2 text-left transition-colors',
    active ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50',
    disabled ? 'cursor-not-allowed opacity-50' : '',
  ].join(' ')
}

/**
 * Pilihan cara kirim nota (layar bayar POS & Bulk Sale). Tidak ada pilihan bawaan: kasir wajib
 * menekan salah satu. `lockedTo` = nota berongkir, hanya "Diantar kurir cabang".
 * `courier`: 'needs-ongkir' = kasir POS tanpa baris ongkir (tombol mati + petunjuk);
 * 'hidden' = Bulk Sale (tidak bisa memuat ongkir).
 */
export function SaleDeliveryPicker({
  value,
  onChange,
  truckFirst,
  lockedTo,
  courier,
}: {
  value: SaleDeliveryMethod | null
  onChange: (value: SaleDeliveryMethod) => void
  truckFirst: boolean
  lockedTo?: SaleDeliveryMethod | null
  courier?: 'needs-ongkir' | 'hidden'
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-foreground">
        Cara kirim <span className="text-destructive">*</span>
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label="Cara kirim">
        {saleDeliveryOrder(truckFirst).filter((m) => !(m === 'BRANCH_COURIER' && courier === 'hidden')).map((m) => {
          const disabled =
            (lockedTo != null && lockedTo !== m) || (m === 'BRANCH_COURIER' && courier === 'needs-ongkir' && lockedTo == null)
          const active = (lockedTo ?? value) === m
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(m)}
              className={choiceClass(active, disabled)}
            >
              <span className="block text-sm font-semibold">{SALE_DELIVERY_LABELS[m]}</span>
              <span className="block text-[11px] text-muted-foreground">{HINTS[m]}</span>
            </button>
          )
        })}
      </div>
      {lockedTo && <p className="mt-1 text-[11px] text-muted-foreground">Nota ini berisi ongkos kirim, jadi diantar kurir cabang.</p>}
      {!lockedTo && courier === 'needs-ongkir' && (
        <p className="mt-1 text-[11px] text-muted-foreground">{COURIER_NEEDS_ONGKIR_MESSAGE}</p>
      )}
      {!lockedTo && value == null && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">Pilih dulu sebelum Bayar.</p>}
    </div>
  )
}

/**
 * Saklar "Wajib pilih cara kirim" untuk layar kasir. null = sedang dimuat. Gagal dibaca: dianggap
 * wajib (server tetap memeriksa).
 */
export function usePosDeliveryRequired(enabled: boolean): boolean | null {
  const [required, setRequired] = useState<boolean | null>(null)
  useEffect(() => {
    if (!enabled || required !== null) return
    let cancelled = false
    fetch('/api/pos/delivery-method')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { required?: boolean } | null) => {
        if (!cancelled) setRequired(data?.required !== false)
      })
      .catch(() => {
        if (!cancelled) setRequired(true)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, required])
  return required
}

/** Pilihan cara kirim PO Internal saat Kirim. */
export function TransferDeliveryPicker({
  value,
  onChange,
}: {
  value: TransferDeliveryMethod | null
  onChange: (value: TransferDeliveryMethod) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-foreground">
        Cara kirim <span className="text-destructive">*</span>
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label="Cara kirim PO Internal">
        {TRANSFER_DELIVERY_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => onChange(m)}
            className={choiceClass(value === m, false)}
          >
            <span className="block text-sm font-semibold">{TRANSFER_DELIVERY_LABELS[m]}</span>
            <span className="block text-[11px] text-muted-foreground">
              {m === 'TRUCK' ? 'Dibawa driver Gudang' : 'Diantar sendiri oleh cabang'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Jendela "Ubah cara kirim" (jalan keluar salah tandai). Alasan wajib; server memeriksa siapa
 * & batas hari. `kind` menentukan pilihan dan alamat API.
 */
export function ChangeDeliveryDialog({
  kind,
  documentKey,
  current,
  onClose,
  onSaved,
}: {
  kind: 'TRANSACTION' | 'INTERNAL_TRANSFER'
  /** Nomor nota (TRANSACTION) atau id PO Internal (INTERNAL_TRANSFER). */
  documentKey: string | number
  current: string | null
  onClose: () => void
  onSaved: (deliveryMethod: string) => void
}) {
  // Kurir cabang tidak bisa dipilih lewat Ubah: hanya lahir dari baris Ongkos Kirim saat bayar.
  const options: readonly string[] =
    kind === 'TRANSACTION' ? SALE_DELIVERY_METHODS.filter((m) => m !== 'BRANCH_COURIER') : TRANSFER_DELIVERY_METHODS
  const labels: Record<string, string> = kind === 'TRANSACTION' ? SALE_DELIVERY_LABELS : TRANSFER_DELIVERY_LABELS
  const [next, setNext] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const url =
    kind === 'TRANSACTION'
      ? `/api/bo/transactions/${encodeURIComponent(String(documentKey))}/delivery-method`
      : `/api/bo/internal-transfers/${documentKey}/delivery-method`

  async function save() {
    if (!next) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryMethod: next, reason }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; deliveryMethod?: string }
      if (!res.ok) {
        setError(data.error ?? `Gagal menyimpan (${res.status})`)
        return
      }
      onSaved(data.deliveryMethod ?? next)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <RequiredChoiceDialog
      title="Ubah cara kirim"
      actions={[
        { label: 'Batal', variant: 'secondary', disabled: busy, onClick: onClose },
        {
          label: busy ? 'Menyimpan…' : 'Simpan',
          variant: 'primary',
          disabled: busy || !next || next === current || !reason.trim(),
          onClick: () => { void save() },
        },
      ]}
    >
      <p className="text-sm">
        Sekarang: <b>{current ? labels[current] ?? current : 'Belum dipilih'}</b>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.filter((m) => m !== current).map((m) => (
          <button key={m} type="button" onClick={() => setNext(m)} className={choiceClass(next === m, false)}>
            <span className="text-sm font-semibold">{labels[m]}</span>
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-medium text-muted-foreground">Alasan (wajib)</label>
      <textarea
        value={reason}
        maxLength={DELIVERY_REASON_MAX}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="Contoh: toko datang ambil sendiri"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Tercatat atas nama Anda. Cabang asal boleh mengubah sampai {DELIVERY_CHANGE_DAYS} hari; sesudahnya Pemilik atau GM.
      </p>
      {kind === 'TRANSACTION' && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Diantar kurir cabang hanya lewat Ongkos Kirim di kasir (pilih pengantar; Gratis ongkir bila tidak ditagih).
        </p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </RequiredChoiceDialog>
  )
}
