'use client'

import { useEffect, useState } from 'react'
import { ageFromBirthDate } from '@/lib/pet-age'
import type { OwnerOption, Pet } from './types'

interface Props {
  /** null = tambah kucing baru */
  pet: Pet | null
  onSuccess: (message: string) => void
  onCancel: () => void
}

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'
const labelClass = 'block text-sm font-medium text-foreground mb-1'

export default function PetForm({ pet, onSuccess, onCancel }: Props) {
  const initialAge = ageFromBirthDate(pet?.birthDate)
  const [name, setName] = useState(pet?.name ?? '')
  const [species, setSpecies] = useState(pet?.species ?? '')
  const [color, setColor] = useState(pet?.color ?? '')
  const [ageYears, setAgeYears] = useState(initialAge ? String(initialAge.years) : '')
  const [ageMonths, setAgeMonths] = useState(initialAge ? String(initialAge.months) : '')

  // Pemilik (hanya saat menambah): pilih yang sudah terdaftar atau daftarkan baru.
  const [ownerMode, setOwnerMode] = useState<'cari' | 'baru'>('cari')
  const [ownerQuery, setOwnerQuery] = useState('')
  const [ownerResults, setOwnerResults] = useState<OwnerOption[]>([])
  const [owner, setOwner] = useState<{ id: number; name: string; phone: string | null } | null>(null)
  const [newOwnerName, setNewOwnerName] = useState('')
  const [newOwnerPhone, setNewOwnerPhone] = useState('')
  const [duplicateOwner, setDuplicateOwner] = useState<{ id: number; name: string; phone: string | null } | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (pet || ownerMode !== 'cari' || owner) return
    const q = ownerQuery.trim()
    if (q.length < 2) {
      setOwnerResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bo/pets/owners?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        if (res.ok) setOwnerResults(await res.json())
      } catch {
        // pencarian dibatalkan / jaringan — biarkan hasil lama
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [pet, ownerMode, owner, ownerQuery])

  function pickExistingOwner(o: { id: number; name: string; phone: string | null }) {
    setOwner(o)
    setOwnerMode('cari')
    setDuplicateOwner(null)
    setErrorMsg(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setDuplicateOwner(null)

    const years = ageYears.trim() ? Number(ageYears) : 0
    const months = ageMonths.trim() ? Number(ageMonths) : 0
    if (!name.trim() || !species.trim() || !color.trim()) {
      setErrorMsg('Nama, jenis, dan warna kucing wajib diisi')
      return
    }
    if (!(years > 0 || months > 0)) {
      setErrorMsg('Umur kucing wajib diisi (tahun atau bulan)')
      return
    }
    if (!pet) {
      if (ownerMode === 'cari' && !owner) {
        setErrorMsg('Pilih pemilik dari hasil pencarian, atau tekan "Pemilik baru"')
        return
      }
      if (ownerMode === 'baru' && (!newOwnerName.trim() || !newOwnerPhone.trim())) {
        setErrorMsg('Nama pemilik dan nomor telepon wajib diisi')
        return
      }
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      species: species.trim(),
      color: color.trim(),
      ageYears: years,
      ageMonths: months,
    }
    if (!pet) {
      if (ownerMode === 'cari' && owner) body.customerId = owner.id
      else body.newOwner = { name: newOwnerName.trim(), phone: newOwnerPhone.trim() }
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(pet ? `/api/bo/pets/${pet.id}` : '/api/bo/pets', {
        method: pet ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = data as { error?: string; existingOwner?: { id: number; name: string; phone: string | null } }
        setErrorMsg(err.error ?? `Gagal menyimpan (${res.status})`)
        if (err.existingOwner) setDuplicateOwner(err.existingOwner)
        return
      }
      onSuccess(pet ? 'Data kucing diperbarui' : 'Kucing ditambahkan')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          <p>{errorMsg}</p>
          {duplicateOwner && (
            <button
              type="button"
              onClick={() => pickExistingOwner(duplicateOwner)}
              className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Pakai pelanggan {duplicateOwner.name}
            </button>
          )}
        </div>
      )}

      {pet ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Pemilik: <b>{pet.ownerName}</b> {pet.ownerPhone ? `— ${pet.ownerPhone}` : ''}
        </div>
      ) : (
        <div className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Pemilik</span>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setOwnerMode('cari')}
                className={`rounded-md px-2 py-1 font-medium ${ownerMode === 'cari' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Sudah terdaftar
              </button>
              <button
                type="button"
                onClick={() => { setOwnerMode('baru'); setOwner(null) }}
                className={`rounded-md px-2 py-1 font-medium ${ownerMode === 'baru' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                Pemilik baru
              </button>
            </div>
          </div>

          {ownerMode === 'cari' && owner && (
            <div className="flex items-center justify-between rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm">
              <span>
                <b>{owner.name}</b> {owner.phone ? `— ${owner.phone}` : ''}
              </span>
              <button type="button" onClick={() => setOwner(null)} className="text-xs font-medium text-primary hover:underline">
                Ganti
              </button>
            </div>
          )}

          {ownerMode === 'cari' && !owner && (
            <>
              <input
                type="text"
                value={ownerQuery}
                onChange={(e) => setOwnerQuery(e.target.value)}
                placeholder="Ketik nama atau nomor HP pemilik"
                className={inputClass}
              />
              {ownerResults.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
                  {ownerResults.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setOwner({ id: o.id, name: o.name, phone: o.phone })}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{o.name}</span>
                        <span className="text-muted-foreground"> {o.phone ?? 'tanpa nomor'}</span>
                        {o.pets.length > 0 && (
                          <span className="block text-xs text-muted-foreground">Kucing: {o.pets.map((p) => p.name).join(', ')}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {ownerQuery.trim().length >= 2 && ownerResults.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Tidak ditemukan. Tekan &quot;Pemilik baru&quot; untuk mendaftarkannya.</p>
              )}
            </>
          )}

          {ownerMode === 'baru' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nama pemilik <span className="text-destructive">*</span></label>
                <input type="text" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} maxLength={100} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Nomor HP <span className="text-destructive">*</span></label>
                <input type="tel" inputMode="numeric" value={newOwnerPhone} onChange={(e) => setNewOwnerPhone(e.target.value)} maxLength={20} className={inputClass} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">Pemilik baru otomatis menjadi pelanggan (golongan Retail).</p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className={labelClass}>Nama kucing <span className="text-destructive">*</span></label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Jenis <span className="text-destructive">*</span></label>
          <input type="text" value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="mis. Persia, Domestik" maxLength={60} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Warna <span className="text-destructive">*</span></label>
          <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="mis. putih, oranye" maxLength={60} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Umur <span className="text-destructive">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="40" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className={inputClass} />
            <span className="text-sm text-muted-foreground">tahun</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="11" value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} className={inputClass} />
            <span className="text-sm text-muted-foreground">bulan</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Cukup perkiraan. Umur akan bertambah sendiri di kunjungan berikutnya.</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan...' : pet ? 'Simpan Perubahan' : 'Simpan Kucing'}
        </button>
      </div>
    </form>
  )
}
