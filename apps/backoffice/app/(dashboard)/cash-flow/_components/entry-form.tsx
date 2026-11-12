'use client'

import { useState, useMemo } from 'react'
import {
  TYPE_LABELS, REPORT_KIND_LABELS, monthChoices, monthLabel,
  type BranchOption, type CashFlowCategoryOption, type CashFlowType, type MoneyPlaceOption,
} from './types'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import { ProofPhotoField } from '@/components/ui/proof-photo-field'
import { NewBadge } from '@/components/ui/new-badge'

interface Props {
  categories: CashFlowCategoryOption[]
  places: MoneyPlaceOption[]
  branches: BranchOption[]
  currentUserName: string
  activeBranchId: number
  isOwner: boolean
  today: string
  onSuccess: () => void
  onError: (msg: string) => void
}

const SHARED = 'shared'
const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

function Label({ htmlFor, children, required }: { htmlFor?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-1">
      {children} {required ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(opsional)</span>}
    </label>
  )
}

export default function EntryForm({ categories, places, branches, currentUserName, activeBranchId, isOwner, today, onSuccess, onError }: Props) {
  const [type, setType] = useState<CashFlowType>('EXPENSE')
  const [categoryId, setCategoryId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [occurredOn, setOccurredOn] = useState(today)
  const [forMonth, setForMonth] = useState(today.slice(0, 7))
  const [forMonthTouched, setForMonthTouched] = useState(false)
  const [branch, setBranch] = useState<string>(String(activeBranchId))
  const [placeId, setPlaceId] = useState<string>('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type && c.isActive && !c.isSystem && (!c.ownerOnly || isOwner)),
    [categories, type, isOwner]
  )
  const selectedCategory = categories.find((c) => String(c.id) === categoryId)
  const minDate = useMemo(() => {
    if (isOwner) return undefined
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7)
    return d.toISOString().slice(0, 10)
  }, [today, isOwner])

  function changeType(t: CashFlowType) {
    setType(t)
    setCategoryId('')
  }

  function changeOccurredOn(value: string) {
    setOccurredOn(value)
    // "Untuk bulan" mengikuti tanggal uang sampai pengguna memilihnya sendiri.
    if (!forMonthTouched && value) setForMonth(value.slice(0, 7))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!categoryId) return setErrorMsg('Kategori wajib dipilih')
    const amountNum = Number(amount)
    if (!amount || !Number.isInteger(amountNum) || amountNum <= 0) return setErrorMsg('Total harus lebih dari 0')
    if (!occurredOn || occurredOn > today) return setErrorMsg('Tanggal uang tidak boleh melewati hari ini')
    if (!placeId) return setErrorMsg(type === 'EXPENSE' ? 'Pilih "Dibayar dari"' : 'Pilih "Masuk ke"')
    if (selectedCategory?.noteRequired && !note.trim()) return setErrorMsg('Catatan wajib diisi untuk kategori ini')
    if (photoUploading) return setErrorMsg('Tunggu foto selesai diunggah')

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bo/cash-flow/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          categoryId: Number(categoryId),
          amount: amountNum,
          note: note.trim() || undefined,
          occurredOn,
          forMonth,
          branchId: branch === SHARED ? null : Number(branch),
          moneyPlaceId: Number(placeId),
          proofPhotoUrl: photo ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menyimpan transaksi (${res.status})`)
        return
      }
      setCategoryId('')
      setAmount('')
      setNote('')
      setPhoto(null)
      onSuccess()
    } catch {
      onError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label required>Tipe</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['INCOME', 'EXPENSE'] as CashFlowType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={[
                'px-3 py-2 text-sm font-medium rounded-md border transition-colors',
                type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent',
              ].join(' ')}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Diinput oleh</label>
        <input type="text" value={currentUserName} readOnly disabled className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/40 text-muted-foreground" />
      </div>

      <div>
        <Label htmlFor="entry-category" required>Kategori</Label>
        <select id="entry-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">— Pilih kategori —</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.reportKind ? ` · ${REPORT_KIND_LABELS[c.reportKind]}` : ''}
            </option>
          ))}
        </select>
        {filteredCategories.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Belum ada kategori {TYPE_LABELS[type].toLowerCase()}. Tambahkan dulu di menu Kategori.
          </p>
        )}
        {selectedCategory && !selectedCategory.reportKind && (
          <p className="text-xs text-amber-700 mt-1">Jenis laporan kategori ini belum dipilih (Biaya / Bukan biaya) — atur di menu Kategori.</p>
        )}
      </div>

      <div>
        <Label htmlFor="entry-amount" required>Total (Rp)</Label>
        <input
          id="entry-amount"
          type="text"
          inputMode="numeric"
          value={formatRupiahInput(amount)}
          onChange={(e) => setAmount(digitsOnly(e.target.value))}
          placeholder="0"
          className={inputClass}
        />
        {type === 'EXPENSE' && selectedCategory?.reportKind === 'COST' && Number(amount) >= 1_000_000 && (
          <p className="text-xs text-muted-foreground mt-1">
            Barang tahan lama? Catat di <a href="/assets" className="text-primary hover:underline">Keuangan › Aset</a> agar biayanya dibagi per bulan.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="entry-date" required>Tanggal uang <NewBadge feature="fitur/arus-kas-rapi" /></Label>
          <input id="entry-date" type="date" value={occurredOn} max={today} min={minDate} onChange={(e) => changeOccurredOn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <Label htmlFor="entry-month" required>Untuk bulan</Label>
          <select
            id="entry-month"
            value={forMonth}
            onChange={(e) => { setForMonth(e.target.value); setForMonthTouched(true) }}
            className={inputClass}
          >
            {monthChoices(occurredOn || today).map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Tanggal uang = kapan uangnya keluar/masuk. Untuk bulan = biaya bulan apa (mis. sewa Oktober dibayar 1 November).
        {!isOwner && ' Tanggal paling jauh 7 hari ke belakang.'}
      </p>

      <div>
        <Label htmlFor="entry-branch" required>Cabang yang menanggung</Label>
        <select id="entry-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={inputClass}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
          <option value={SHARED}>Bersama (beberapa cabang)</option>
        </select>
      </div>

      <div>
        <Label htmlFor="entry-place" required>{type === 'EXPENSE' ? 'Dibayar dari' : 'Masuk ke'}</Label>
        <select id="entry-place" value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={inputClass}>
          <option value="">— Pilih Tempat Uang —</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.kind === 'CASH' ? 'Tunai' : 'Rekening'})
            </option>
          ))}
        </select>
        {places.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">Belum ada Tempat Uang. Tambahkan di Pengaturan › Tempat Uang.</p>
        )}
      </div>

      <ProofPhotoField value={photo} onChange={setPhoto} onUploadingChange={setPhotoUploading} disabled={isSubmitting} label="Foto Bukti" />

      <div>
        <Label htmlFor="entry-note" required={selectedCategory?.noteRequired}>Catatan</Label>
        <textarea
          id="entry-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={255}
          rows={2}
          placeholder="Keterangan tambahan"
          className={`${inputClass} resize-none`}
        />
      </div>

      {errorMsg && (
        <div role="alert" aria-live="assertive" className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
      </button>
    </form>
  )
}
