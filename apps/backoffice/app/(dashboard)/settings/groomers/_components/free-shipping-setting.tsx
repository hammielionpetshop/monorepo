'use client'

import { useState } from 'react'
import { NewBadge } from '@/components/ui/new-badge'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'

// Nilai gratis ongkir (ongkir standar toko). Dipakai saat kasir mencentang "Gratis ongkir".
export default function FreeShippingSetting({ initialValue }: { initialValue: number }) {
  const [value, setValue] = useState(initialValue)
  const [draft, setDraft] = useState(String(initialValue))
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const next = Number(draft.replace(/\D/g, ''))

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/bo/settings/free-shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: (data as { error?: string }).error ?? `Gagal menyimpan (${res.status})` })
        return
      }
      setValue((data as { value: number }).value)
      setMessage({ type: 'ok', text: 'Tersimpan. Nota lama tidak berubah.' })
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan, silakan coba lagi' })
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      {confirming && (
        <RequiredChoiceDialog
          title="Ubah nilai gratis ongkir?"
          tone="warning"
          actions={[
            { label: 'Batal', variant: 'secondary', disabled: busy, onClick: () => setConfirming(false) },
            { label: busy ? 'Menyimpan…' : 'Ya, simpan', variant: 'primary', disabled: busy, onClick: () => { void save() } },
          ]}
        >
          <p>
            Dari Rp {value.toLocaleString('id-ID')} menjadi <b>Rp {next.toLocaleString('id-ID')}</b>. Berlaku untuk gratis ongkir
            berikutnya di semua cabang (tab Kasir &amp; tab Grooming). Nota yang sudah tersimpan tidak berubah.
          </p>
          <p>Perubahan ini tercatat atas nama Anda.</p>
        </RequiredChoiceDialog>
      )}
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        Nilai gratis ongkir (ongkir standar) <NewBadge feature="fitur/nilai-gratis-ongkir" />
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Saat kasir mencentang &quot;Gratis ongkir&quot;, ongkir tercatat sebesar nilai ini (ditanggung toko), pelanggan tidak
        membayar, dan pengantar tidak mendapat bonus. Harus kelipatan Rp 1.000.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Rupiah</label>
          <input className={inputClass} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <button
          type="button"
          disabled={busy || !(next > 0) || next === value}
          onClick={() => setConfirming(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Simpan
        </button>
        <span className="text-xs text-muted-foreground">Sekarang: Rp {value.toLocaleString('id-ID')}</span>
      </div>
      {message && (
        <p className={`mt-2 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-destructive'}`}>{message.text}</p>
      )}
    </section>
  )
}
