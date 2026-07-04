'use client'

import { useState } from 'react'
import Big from 'big.js'

interface UomOption {
  id: number
  code: string
  name: string
}

export interface ExistingConversion {
  id: number
  uomId: number | null
  ratio: number | null
  weightGram: number | null
  priceBranches?: string[]
}

export interface SavedConversionInfo {
  uomId: number
  uomCode: string
  uomName: string
  ratio: number
  mode: 'created' | 'updated'
}

interface Props {
  productId: number
  availableUoms: UomOption[]
  baseUomId?: number
  existingConversions: ExistingConversion[]
  onSuccess: (info: SavedConversionInfo) => void
  onCancel: () => void
  onNewUomCreated?: (uom: UomOption) => void
}

export default function UomConversionForm({
  productId,
  availableUoms,
  baseUomId,
  existingConversions,
  onSuccess,
  onCancel,
  onNewUomCreated,
}: Props) {
  const [uomId, setUomId] = useState<string>('')
  const [ratio, setRatio] = useState<string>('')
  const [weightGram, setWeightGram] = useState<string>('')
  const [confirmGlobalChange, setConfirmGlobalChange] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [localUoms, setLocalUoms] = useState<UomOption[]>(availableUoms)
  const [showCreateUom, setShowCreateUom] = useState(false)
  const [newUomCode, setNewUomCode] = useState('')
  const [newUomName, setNewUomName] = useState('')
  const [isCreatingUom, setIsCreatingUom] = useState(false)
  const [createUomError, setCreateUomError] = useState<string | null>(null)

  async function handleCreateUom() {
    if (isCreatingUom) return
    if (!newUomCode.trim()) { setCreateUomError('Kode wajib diisi'); return }
    if (!newUomName.trim()) { setCreateUomError('Nama wajib diisi'); return }

    setIsCreatingUom(true)
    setCreateUomError(null)
    try {
      const res = await fetch('/api/bo/master-data/uom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newUomCode.trim().toUpperCase(),
          name: newUomName.trim(),
          isBase: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateUomError(data.error ?? 'Gagal membuat satuan baru')
        return
      }
      const created: UomOption = { id: data.id, code: data.code, name: data.name }
      setLocalUoms((prev) => [...prev, created])
      setUomId(String(created.id))
      onNewUomCreated?.(created)
      setShowCreateUom(false)
      setNewUomCode('')
      setNewUomName('')
    } catch {
      setCreateUomError('Terjadi kesalahan jaringan')
    } finally {
      setIsCreatingUom(false)
    }
  }

  const selectedUomId = uomId ? Number(uomId) : null
  const isSameAsBase = baseUomId !== undefined && selectedUomId === baseUomId
  const existingForSelected = selectedUomId !== null
    ? existingConversions.find((c) => c.uomId === selectedUomId) ?? null
    : null
  const isUpdateMode = existingForSelected !== null

  function handleSelectUom(value: string) {
    setUomId(value)
    setErrorMsg(null)
    setConfirmGlobalChange(false)
    const existing = value
      ? existingConversions.find((c) => c.uomId === Number(value))
      : undefined
    if (existing) {
      setRatio(existing.ratio !== null ? String(existing.ratio) : '')
      setWeightGram(existing.weightGram !== null ? String(existing.weightGram) : '')
    } else {
      setRatio('')
      setWeightGram('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isSubmitting) return

    // Validasi client-side
    if (!uomId) {
      setErrorMsg('UOM wajib dipilih')
      return
    }

    let ratioBig: Big
    try {
      ratioBig = new Big(ratio)
      if (ratioBig.lte(0)) throw new Error()
    } catch {
      setErrorMsg('Ratio harus lebih dari 0')
      return
    }

    if (weightGram.trim()) {
      try {
        const w = new Big(weightGram)
        if (w.lte(0)) throw new Error()
      } catch {
        setErrorMsg('Berat harus lebih dari 0')
        return
      }
    }

    if (isUpdateMode && !confirmGlobalChange) {
      setErrorMsg('Centang konfirmasi terlebih dahulu — perubahan ratio berlaku untuk SEMUA cabang')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const url = isUpdateMode
        ? `/api/bo/master-data/products/${productId}/uom-conversions/${existingForSelected.id}`
        : `/api/bo/master-data/products/${productId}/uom-conversions`
      const res = await fetch(url, {
        method: isUpdateMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isUpdateMode ? {} : { uomId: Number(uomId) }),
          ratio: ratioBig.toString(),
          weightGram: weightGram.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Terjadi kesalahan saat menyimpan')
        return
      }

      const savedUom = localUoms.find((u) => u.id === Number(uomId))
      const info: SavedConversionInfo = {
        uomId: Number(uomId),
        uomCode: savedUom?.code ?? '',
        uomName: savedUom?.name ?? '',
        ratio: Math.round(ratioBig.toNumber()),
        mode: isUpdateMode ? 'updated' : 'created',
      }

      // Reset form
      setUomId('')
      setRatio('')
      setWeightGram('')
      setConfirmGlobalChange(false)
      onSuccess(info)
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Peringatan scope global — konversi bukan per-cabang */}
      <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md text-xs bg-amber-50 border border-amber-300 text-amber-800">
        <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-600 text-white font-semibold tracking-wide">GLOBAL</span>
        <span>Konversi satuan berlaku untuk <strong>semua cabang</strong>, bukan hanya cabang yang sedang dilihat.</span>
      </div>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-3 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        {/* UOM select */}
        <div>
          <label htmlFor="uom-select" className="block text-xs font-medium text-muted-foreground mb-1">
            Satuan (UOM) <span className="text-destructive">*</span>
          </label>
          <select
            id="uom-select"
            value={uomId}
            onChange={(e) => handleSelectUom(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isSubmitting || showCreateUom}
          >
            <option value="">-- Pilih UOM --</option>
            {localUoms.map((uom) => {
              const configured = existingConversions.find((c) => c.uomId === uom.id)
              return (
                <option key={uom.id} value={uom.id}>
                  {uom.name} ({uom.code}){configured ? ` — terpasang, ratio ${configured.ratio ?? '-'}` : ''}
                </option>
              )
            })}
          </select>
          {isSameAsBase && (
            <p className="mt-1 text-xs text-amber-600">
              UOM ini sama dengan UOM dasar produk. Pastikan ini disengaja.
            </p>
          )}
          {!showCreateUom ? (
            <button
              type="button"
              onClick={() => { setShowCreateUom(true); setCreateUomError(null) }}
              disabled={isSubmitting}
              className="mt-1.5 text-xs text-primary hover:underline disabled:opacity-50"
            >
              + Buat satuan baru
            </button>
          ) : (
            <div className="mt-2 p-3 border border-border rounded-md bg-muted/30 space-y-2">
              <p className="text-xs font-medium text-foreground">Satuan baru</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newUomCode}
                  onChange={(e) => { setNewUomCode(e.target.value.toUpperCase()); setCreateUomError(null) }}
                  maxLength={10}
                  placeholder="Kode (mis: DUS)"
                  className="w-24 px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isCreatingUom}
                />
                <input
                  type="text"
                  value={newUomName}
                  onChange={(e) => { setNewUomName(e.target.value); setCreateUomError(null) }}
                  maxLength={50}
                  placeholder="Nama (mis: Dus)"
                  className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isCreatingUom}
                />
              </div>
              {createUomError && (
                <p className="text-xs text-destructive">{createUomError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateUom}
                  disabled={isCreatingUom}
                  className="px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {isCreatingUom ? 'Menyimpan...' : 'Buat'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateUom(false); setNewUomCode(''); setNewUomName(''); setCreateUomError(null) }}
                  disabled={isCreatingUom}
                  className="px-3 py-1 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ratio input */}
        <div>
          <label htmlFor="ratio-input" className="block text-xs font-medium text-muted-foreground mb-1">
            Ratio <span className="text-destructive">*</span>
            <span className="text-xs font-normal ml-1">(1 UOM ini = N × UOM Dasar)</span>
          </label>
          <input
            id="ratio-input"
            type="text"
            inputMode="decimal"
            value={ratio}
            onChange={(e) => {
              setRatio(e.target.value)
              setErrorMsg(null)
            }}
            placeholder="Contoh: 12"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isSubmitting}
          />
        </div>

        {/* Weight gram input */}
        <div>
          <label htmlFor="weight-input" className="block text-xs font-medium text-muted-foreground mb-1">
            Berat (gram)
            <span className="text-xs font-normal ml-1">(opsional)</span>
          </label>
          <input
            id="weight-input"
            type="text"
            inputMode="decimal"
            value={weightGram}
            onChange={(e) => {
              setWeightGram(e.target.value)
              setErrorMsg(null)
            }}
            placeholder="Contoh: 500"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Konfirmasi bentrok — UOM sudah terpasang, ubah ratio berdampak semua cabang */}
      {isUpdateMode && (
        <div className="mb-3 p-3 rounded-md border border-amber-300 bg-amber-50 space-y-2">
          <p className="text-xs text-amber-800">
            Satuan ini <strong>sudah terpasang</strong> dengan ratio{' '}
            <strong>{existingForSelected.ratio ?? '-'}</strong>.
            {(existingForSelected.priceBranches?.length ?? 0) > 0 && (
              <>
                {' '}Harga untuk satuan ini sudah diatur di cabang:{' '}
                <strong>{existingForSelected.priceBranches!.join(', ')}</strong>.
              </>
            )}
          </p>
          <label className="flex items-start gap-2 text-xs text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmGlobalChange}
              onChange={(e) => { setConfirmGlobalChange(e.target.checked); setErrorMsg(null) }}
              className="mt-0.5"
              disabled={isSubmitting}
            />
            <span>
              Saya mengerti perubahan ratio ini akan berlaku untuk <strong>SEMUA cabang</strong> yang
              memakai satuan ini.
            </span>
          </label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting || (isUpdateMode && !confirmGlobalChange)}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan...' : isUpdateMode ? 'Ubah Ratio (Semua Cabang)' : 'Simpan'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          Batal
        </button>
      </div>
    </form>
  )
}
