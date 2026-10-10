'use client'

import { useState } from 'react'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import type { Option } from './types'

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

export interface PayTarget {
  id: number
  poNumber: string
  supplierName: string | null
  /** Sisa tagihan saat jendela dibuka. */
  remaining: number
  /** Saldo supplier (kelebihan retur) yang bisa dipakai membayar tagihan ini. */
  creditBalance?: number
}

/**
 * Form Catat Pembayaran ke Supplier — dipakai halaman Hutang Supplier dan detail PO (setelah
 * penerimaan disetujui). Tidak tertutup oleh klik di luar kotak; hanya lewat Batal / Simpan.
 */
export function SupplierPaymentDialog({
  target,
  paymentMethods,
  today,
  onClose,
  onSaved,
}: {
  target: PayTarget
  paymentMethods: Option[]
  /** Tanggal hari ini (WIB, YYYY-MM-DD) — batas atas tanggal bayar. */
  today: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const creditBalance = target.creditBalance ?? 0
  const [useCredit, setUseCredit] = useState(false)
  const [payAmount, setPayAmount] = useState(String(target.remaining))
  const [payDate, setPayDate] = useState(today)
  const [payMethod, setPayMethod] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payNote, setPayNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    const amount = parseInt(payAmount, 10)
    if (!payAmount || isNaN(amount) || amount <= 0) return setFormError('Nominal harus lebih dari 0')
    if (amount > target.remaining) return setFormError(`Nominal tidak boleh melebihi sisa tagihan (${rupiah(target.remaining)})`)
    if (!payDate || payDate > today) return setFormError('Tanggal bayar tidak boleh melewati hari ini')
    if (useCredit && amount > creditBalance) return setFormError(`Nominal melebihi saldo supplier (${rupiah(creditBalance)})`)
    if (!useCredit && !payMethod) return setFormError('Pilih metode pembayaran')

    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/bo/supplier-payables/${target.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method: useCredit ? 'SALDO SUPPLIER' : payMethod,
          useSupplierCredit: useCredit || undefined,
          paidDate: payDate,
          referenceNumber: payRef.trim() || undefined,
          note: payNote.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error ?? 'Terjadi kesalahan')
        return
      }
      onSaved(
        amount >= target.remaining
          ? `Pembayaran dicatat — ${target.poNumber} lunas`
          : `Pembayaran dicatat — sisa ${target.poNumber}: ${rupiah(target.remaining - amount)}`
      )
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div role="dialog" aria-modal="true" className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Catat Pembayaran ke Supplier</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {target.supplierName ?? '-'} · <span className="font-mono">{target.poNumber}</span> — sisa tagihan:{' '}
          <span className="font-semibold text-foreground">{rupiah(target.remaining)}</span>
        </p>

        {formError && (
          <div role="alert" aria-live="assertive" className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {creditBalance > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 cursor-pointer">
              <input
                type="checkbox"
                checked={useCredit}
                onChange={e => {
                  setUseCredit(e.target.checked)
                  if (e.target.checked) setPayAmount(String(Math.min(target.remaining, creditBalance)))
                }}
                className="mt-0.5"
              />
              <span>
                Bayar dari Saldo Supplier — tersedia <span className="font-semibold">{rupiah(creditBalance)}</span>
                <span className="block text-xs text-emerald-800">Saldo dari kelebihan retur barang ke supplier ini.</span>
              </span>
            </label>
          )}

          <Field label="Nominal Pembayaran" required>
            <input
              type="text"
              inputMode="numeric"
              value={formatRupiahInput(payAmount)}
              onChange={e => setPayAmount(digitsOnly(e.target.value))}
              onFocus={e => e.target.select()}
              placeholder="Masukkan nominal"
              className={inputClass}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal Bayar" required>
              <input type="date" value={payDate} max={today} onChange={e => setPayDate(e.target.value)} className={inputClass} required />
            </Field>
            <Field label="Metode Pembayaran" required>
              {useCredit ? (
                <div className={`${inputClass} bg-muted text-muted-foreground`}>Saldo Supplier</div>
              ) : (
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputClass} required>
                  <option value="">— Pilih —</option>
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <Field label="No. Bukti Transfer">
            <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Opsional" maxLength={100} className={inputClass} />
          </Field>

          <Field label="Keterangan">
            <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Opsional" maxLength={500} className={inputClass} />
          </Field>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  )
}
