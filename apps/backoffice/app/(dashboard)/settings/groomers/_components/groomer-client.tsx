'use client'

import { useState } from 'react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'

interface Groomer {
  id: number
  name: string
  isActive: boolean
  isGroomer: boolean
  isCourier: boolean
}

function RoleBoxes({ isGroomer, isCourier, onChange }: { isGroomer: boolean; isCourier: boolean; onChange: (next: { isGroomer: boolean; isCourier: boolean }) => void }) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={isGroomer} onChange={(e) => onChange({ isGroomer: e.target.checked, isCourier })} />
        Groomer (memandikan)
      </label>
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={isCourier} onChange={(e) => onChange({ isGroomer, isCourier: e.target.checked })} />
        Pengantar (antar-jemput)
      </label>
    </div>
  )
}

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'

export default function GroomerClient({ groomers: initial }: { groomers: Groomer[] }) {
  const [groomers, setGroomers] = useState<Groomer[]>(initial)
  const [newName, setNewName] = useState('')
  const [newRoles, setNewRoles] = useState({ isGroomer: true, isCourier: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [renaming, setRenaming] = useState<{ groomer: Groomer; name: string; isGroomer: boolean; isCourier: boolean } | null>(null)
  const [toggling, setToggling] = useState<Groomer | null>(null)

  async function refresh() {
    const res = await fetch('/api/bo/groomers')
    if (res.ok) setGroomers(await res.json())
  }

  async function send(url: string, method: 'POST' | 'PATCH', body: unknown, okText: string): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: (data as { error?: string }).error ?? `Gagal menyimpan (${res.status})` })
        return false
      }
      setMessage({ type: 'ok', text: okText })
      await refresh()
      return true
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan jaringan, silakan coba lagi' })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      setMessage({ type: 'error', text: 'Nama groomer wajib diisi' })
      return
    }
    if (!newRoles.isGroomer && !newRoles.isCourier) {
      setMessage({ type: 'error', text: 'Pilih minimal satu tugas: Groomer atau Pengantar' })
      return
    }
    if (await send('/api/bo/groomers', 'POST', { name, ...newRoles }, `${name} ditambahkan`)) {
      setNewName('')
      setNewRoles({ isGroomer: true, isCourier: false })
    }
  }

  async function handleRename() {
    if (!renaming) return
    const name = renaming.name.trim()
    if (!name) {
      setMessage({ type: 'error', text: 'Nama groomer wajib diisi' })
      return
    }
    if (!renaming.isGroomer && !renaming.isCourier) {
      setMessage({ type: 'error', text: 'Pilih minimal satu tugas: Groomer atau Pengantar' })
      return
    }
    if (await send(`/api/bo/groomers/${renaming.groomer.id}`, 'PATCH', { name, isGroomer: renaming.isGroomer, isCourier: renaming.isCourier }, 'Data diperbarui')) setRenaming(null)
  }

  async function handleToggle() {
    if (!toggling) return
    const next = !toggling.isActive
    await send(`/api/bo/groomers/${toggling.id}`, 'PATCH', { isActive: next }, `${toggling.name} ${next ? 'diaktifkan kembali' : 'dinonaktifkan'}`)
    setToggling(null)
  }

  return (
    <>
      {toggling && (
        <RequiredChoiceDialog
          title={toggling.isActive ? `Nonaktifkan groomer ${toggling.name}?` : `Aktifkan kembali groomer ${toggling.name}?`}
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setToggling(null), variant: 'secondary', disabled: busy },
            { label: busy ? 'Memproses...' : toggling.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan', onClick: () => { void handleToggle() }, variant: 'primary', disabled: busy },
          ]}
        >
          {toggling.isActive ? (
            <p>
              Nama ini tidak akan muncul lagi di pilihan kasir. Riwayat grooming, delivery, dan bonus yang sudah tercatat atas
              namanya <b>tetap utuh</b>. Bisa diaktifkan kembali kapan saja.
            </p>
          ) : (
            <p>Groomer ini akan muncul lagi di pilihan kasir.</p>
          )}
        </RequiredChoiceDialog>
      )}

      {renaming && (
        <RequiredChoiceDialog
          title={`Ubah nama / tugas ${renaming.groomer.name}`}
          actions={[
            { label: 'Batal', onClick: () => setRenaming(null), variant: 'secondary', disabled: busy },
            { label: busy ? 'Menyimpan...' : 'Simpan', onClick: () => { void handleRename() }, variant: 'primary', disabled: busy },
          ]}
        >
          <p className="mb-3">
            Nama hanya untuk membetulkan salah ketik. Riwayat lama ikut menampilkan nama baru — <b>jangan</b> dipakai
            untuk mengganti orang; untuk orang baru, tambahkan nama baru.
          </p>
          <input
            type="text"
            value={renaming.name}
            onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
            maxLength={100}
            className={inputClass}
          />
          <div className="mt-3">
            <RoleBoxes isGroomer={renaming.isGroomer} isCourier={renaming.isCourier} onChange={(next) => setRenaming({ ...renaming, ...next })} />
          </div>
        </RequiredChoiceDialog>
      )}

      <form onSubmit={handleAdd} className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="groomer-name" className="block text-sm font-medium text-foreground mb-1">
            Tambah groomer / pengantar
          </label>
          <input
            id="groomer-name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama"
            maxLength={100}
            className={inputClass}
          />
          <div className="mt-2">
            <RoleBoxes isGroomer={newRoles.isGroomer} isCourier={newRoles.isCourier} onChange={setNewRoles} />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? 'Menyimpan...' : 'Tambah'}
        </button>
      </form>

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

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Nama</th>
              <th className="px-4 py-2 font-medium">Tugas</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {groomers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Belum ada nama. Tambahkan groomer atau pengantar di kotak di atas.
                </td>
              </tr>
            )}
            {groomers.map((g) => (
              <tr key={g.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium text-foreground">{g.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{[g.isGroomer ? 'Groomer' : '', g.isCourier ? 'Pengantar' : ''].filter(Boolean).join(' + ')}</td>
                <td className="px-4 py-2">
                  {g.isActive ? (
                    <span className="inline-block rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">Aktif</span>
                  ) : (
                    <span className="inline-block rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Nonaktif</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setRenaming({ groomer: g, name: g.name, isGroomer: g.isGroomer, isCourier: g.isCourier })} className="mr-3 text-xs font-medium text-primary hover:underline">
                    Ubah
                  </button>
                  <button onClick={() => setToggling(g)} className="text-xs font-medium text-amber-700 hover:underline">
                    {g.isActive ? 'Nonaktifkan' : 'Aktifkan'}
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
