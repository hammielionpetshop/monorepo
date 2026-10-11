'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { formatPetAge } from '@/lib/pet-age'
import PetForm from './pet-form'
import { filterPets, type Pet } from './types'

export default function PetClient({ pets: initial }: { pets: Pet[] }) {
  const [pets, setPets] = useState<Pet[]>(initial)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ pet: Pet | null } | null>(null)
  const [toggling, setToggling] = useState<Pet | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function refresh() {
    const res = await fetch('/api/bo/pets')
    if (res.ok) setPets(await res.json())
  }

  async function handleToggle() {
    if (!toggling || busy) return
    const next = !toggling.isActive
    setBusy(true)
    try {
      const res = await fetch(`/api/bo/pets/${toggling.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: (data as { error?: string }).error ?? `Gagal mengubah status (${res.status})` })
        return
      }
      setMessage({ type: 'ok', text: `${toggling.name} ${next ? 'diaktifkan kembali' : 'dinonaktifkan'}` })
      await refresh()
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan, silakan coba lagi' })
    } finally {
      setBusy(false)
      setToggling(null)
    }
  }

  const filtered = filterPets(pets, search)

  return (
    <>
      {toggling && (
        <RequiredChoiceDialog
          title={toggling.isActive ? `Nonaktifkan data kucing ${toggling.name}?` : `Aktifkan kembali data kucing ${toggling.name}?`}
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setToggling(null), variant: 'secondary', disabled: busy },
            { label: busy ? 'Memproses...' : toggling.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan', onClick: () => { void handleToggle() }, variant: 'primary', disabled: busy },
          ]}
        >
          {toggling.isActive ? (
            <p>
              Kucing ini tidak akan muncul lagi saat pemiliknya dicari di kasir (misalnya kucing sudah tidak ada).
              Riwayat groomingnya <b>tetap utuh</b>. Bisa diaktifkan kembali kapan saja.
            </p>
          ) : (
            <p>Kucing ini akan muncul lagi saat pemiliknya dicari di kasir.</p>
          )}
        </RequiredChoiceDialog>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="mt-8 w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-lg" role="dialog" aria-modal="true">
            <h2 className="mb-4 text-lg font-semibold text-foreground">{form.pet ? `Ubah data ${form.pet.name}` : 'Tambah Kucing'}</h2>
            <PetForm
              pet={form.pet}
              onCancel={() => setForm(null)}
              onSuccess={(text) => {
                setForm(null)
                setMessage({ type: 'ok', text })
                void refresh()
              }}
            />
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama kucing, nama pemilik, atau nomor HP"
          className="w-full max-w-md border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={() => setForm({ pet: null })}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Tambah Kucing
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-md border px-4 py-3 text-sm ${
            message.type === 'ok'
              ? 'border-green-500/20 bg-green-500/10 text-green-700'
              : 'border-destructive/20 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Kucing</th>
              <th className="px-4 py-2 font-medium">Jenis</th>
              <th className="px-4 py-2 font-medium">Warna</th>
              <th className="px-4 py-2 font-medium">Umur</th>
              <th className="px-4 py-2 font-medium">Pemilik</th>
              <th className="px-4 py-2 font-medium">Nomor HP</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {pets.length === 0 ? 'Belum ada data kucing.' : 'Tidak ada yang cocok dengan pencarian.'}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium text-foreground">{p.name}</td>
                <td className="px-4 py-2">{p.species}</td>
                <td className="px-4 py-2">{p.color}</td>
                <td className="px-4 py-2 whitespace-nowrap">{formatPetAge(p.birthDate)}</td>
                <td className="px-4 py-2">
                  <Link href={`/master-data/customers/${p.customerId}`} className="text-primary hover:underline">
                    {p.ownerName}
                  </Link>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{p.ownerPhone ?? '-'}</td>
                <td className="px-4 py-2">
                  {p.isActive ? (
                    <span className="inline-block rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">Aktif</span>
                  ) : (
                    <span className="inline-block rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Nonaktif</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setForm({ pet: p })} className="mr-3 text-xs font-medium text-primary hover:underline">
                    Ubah
                  </button>
                  <button onClick={() => setToggling(p)} className="text-xs font-medium text-amber-700 hover:underline">
                    {p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
