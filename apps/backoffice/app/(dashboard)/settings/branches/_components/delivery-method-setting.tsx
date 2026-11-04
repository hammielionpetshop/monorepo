'use client'

import { useState } from 'react'
import { NewBadge } from '@/components/ui/new-badge'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'

interface BranchChoice {
  id: number
  name: string
}

/**
 * Saklar cara kirim (Owner/GM): wajib pilih saat bayar + cabang yang tombol "Truk Gudang"-nya
 * paling depan. Dimatikan = pilihan, kolom, dan saringan Cara Kirim disembunyikan; data lama tetap.
 */
export default function DeliveryMethodSetting({
  initialRequired,
  initialTruckFirstBranchIds,
  branches,
}: {
  initialRequired: boolean
  initialTruckFirstBranchIds: number[]
  branches: BranchChoice[]
}) {
  const [required, setRequired] = useState(initialRequired)
  const [truckFirst, setTruckFirst] = useState<number[]>(initialTruckFirstBranchIds)
  const [saved, setSaved] = useState({ required: initialRequired, truckFirst: initialTruckFirstBranchIds })
  const [confirmOff, setConfirmOff] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const dirty =
    required !== saved.required ||
    [...truckFirst].sort().join(',') !== [...saved.truckFirst].sort().join(',')

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/bo/settings/delivery-method', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required, truckFirstBranchIds: truckFirst }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; required?: boolean; truckFirstBranchIds?: number[] }
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? `Gagal menyimpan (${res.status})` })
        return
      }
      setSaved({ required: data.required ?? required, truckFirst: data.truckFirstBranchIds ?? truckFirst })
      setMessage({ type: 'ok', text: 'Tersimpan. Berlaku untuk nota berikutnya; nota lama tidak berubah.' })
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan, silakan coba lagi' })
    } finally {
      setBusy(false)
      setConfirmOff(false)
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4">
      {confirmOff && (
        <RequiredChoiceDialog
          title="Matikan wajib pilih cara kirim?"
          tone="warning"
          actions={[
            { label: 'Batal', variant: 'secondary', disabled: busy, onClick: () => setConfirmOff(false) },
            { label: busy ? 'Menyimpan…' : 'Ya, matikan', variant: 'primary', disabled: busy, onClick: () => { void save() } },
          ]}
        >
          <p>
            Pilihan &quot;Dikirim truk Gudang&quot; disembunyikan, Bulk Sale dan Kirim PO Internal tidak ditanya cara kirim, dan kolom &amp;
            saringan Cara Kirim disembunyikan. Langkah Pengiriman kasir (Ambil sendiri / Kurir cabang + ongkir) tetap ada karena ongkos
            kirim diisi di sana. Data yang sudah tercatat tetap tersimpan, dan bisa dinyalakan lagi kapan saja.
          </p>
        </RequiredChoiceDialog>
      )}
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
        Cara kirim nota <NewBadge feature="fitur/cara-kirim" />
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Sebelum layar bayar, kasir menjawab langkah Pengiriman: Ambil sendiri, Kurir cabang (pengantar + ongkir / Gratis ongkir),
        atau Dikirim truk Gudang (gratis ongkir, nota berpelanggan). Bulk Sale: Ambil sendiri / Truk Gudang. Kirim PO Internal:
        Truk Gudang / Kirim sendiri.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="h-4 w-4" />
        <span className="font-medium">Wajib pilih cara kirim</span>
      </label>
      <p className="mb-1 text-xs font-medium text-muted-foreground">Tombol &quot;Dikirim truk Gudang&quot; paling depan di cabang:</p>
      <div className="mb-3 flex flex-wrap gap-3">
        {branches.map((b) => (
          <label key={b.id} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={truckFirst.includes(b.id)}
              onChange={(e) => setTruckFirst((cur) => (e.target.checked ? [...cur, b.id] : cur.filter((id) => id !== b.id)))}
            />
            {b.name}
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={busy || !dirty}
        onClick={() => (saved.required && !required ? setConfirmOff(true) : void save())}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? 'Menyimpan…' : 'Simpan'}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-destructive'}`}>{message.text}</p>
      )}
    </section>
  )
}
