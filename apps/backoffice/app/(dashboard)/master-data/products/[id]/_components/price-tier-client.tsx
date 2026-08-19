'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Big from 'big.js'
import { PRICE_TIERS } from '@petshop/shared'

type TierType = (typeof PRICE_TIERS)[number]

interface BranchOption {
  id: number
  code: string
  name: string
}

interface UomForPricing {
  id: number
  code: string
  name: string
  isBase: boolean
  ratio: number
}

interface PriceEntry {
  uomId: number
  tierType: string
  price: string
}

type LocalPrices = Record<number, Partial<Record<TierType, string>>>

interface Props {
  productId: number
  branches: BranchOption[]
  uomsForPricing: UomForPricing[]
}

export default function PriceTierClient({ productId, branches, uomsForPricing }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(
    branches[0]?.id ?? null
  )
  const [localPrices, setLocalPrices] = useState<LocalPrices>({})
  // Sel yang benar-benar disentuh user sejak fetch terakhir (`${uomId}:${tier}`).
  // Simpan HANYA mengirim sel di sini — bukan seluruh localPrices — supaya tidak
  // menimpa balik harga yang baru diubah orang lain lewat grid Master Data > Harga
  // di sel yang tidak disentuh di halaman ini.
  const [dirty, setDirty] = useState<Record<string, true>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  const fetchPrices = useCallback(async (branchId: number) => {
    // Batalkan fetch sebelumnya jika masih in-flight
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setLocalPrices({})
    setDirty({})
    setErrorMsg(null)
    try {
      const res = await fetch(
        `/api/bo/master-data/products/${productId}/prices?branchId=${branchId}`,
        { signal: controller.signal }
      )
      if (!res.ok) {
        setErrorMsg('Gagal mengambil data harga')
        return
      }
      const data: PriceEntry[] = await res.json()
      const map: LocalPrices = {}
      for (const entry of data) {
        if (!map[entry.uomId]) map[entry.uomId] = {}
        map[entry.uomId][entry.tierType as TierType] = String(entry.price)
      }
      setLocalPrices(map)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setErrorMsg('Terjadi kesalahan jaringan saat mengambil harga')
    } finally {
      setIsLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (selectedBranchId !== null) fetchPrices(selectedBranchId)
    else setLocalPrices({})
  }, [selectedBranchId, fetchPrices])

  function cellKey(uomId: number, tier: TierType) {
    return `${uomId}:${tier}`
  }

  function handlePriceChange(uomId: number, tier: TierType, value: string) {
    // Hitung sekali: UOM mana saja yang berubah akibat edit ini (sel yang diketik +
    // hasil auto-kalkulasi UOM lain), dipakai untuk localPrices maupun dirty supaya
    // dua-duanya selalu sinkron.
    let derivedByUom: Record<number, string> | null = null
    if (uomsForPricing.length > 1) {
      const sourceUom = uomsForPricing.find((u) => u.id === uomId)
      if (sourceUom) {
        try {
          const sourcePrice = new Big(value.trim())
          if (sourcePrice.gte(0)) {
            // Hitung harga dasar (per unit base UOM), lalu turunkan ke UOM lain
            const basePrice = sourcePrice.div(sourceUom.ratio)
            derivedByUom = {}
            for (const otherUom of uomsForPricing) {
              if (otherUom.id === uomId) continue
              derivedByUom[otherUom.id] = basePrice.times(otherUom.ratio).round(0).toString()
            }
          }
        } catch {
          // Nilai tidak valid — biarkan hanya sel ini yang berubah
        }
      }
    }

    setLocalPrices((prev) => {
      const next: LocalPrices = { ...prev, [uomId]: { ...prev[uomId], [tier]: value } }
      if (derivedByUom) {
        for (const [otherUomId, derived] of Object.entries(derivedByUom)) {
          const oid = Number(otherUomId)
          next[oid] = { ...next[oid], [tier]: derived }
        }
      }
      return next
    })

    setDirty((prev) => {
      const next = { ...prev, [cellKey(uomId, tier)]: true as const }
      if (derivedByUom) {
        for (const otherUomId of Object.keys(derivedByUom)) {
          next[cellKey(Number(otherUomId), tier)] = true
        }
      }
      return next
    })
  }

  async function handleSave() {
    if (!selectedBranchId || isSaving) return

    const dirtyKeys = Object.keys(dirty)
    if (dirtyKeys.length === 0) return

    const changes: { uomId: number; tierType: string; price: string }[] = []
    const deletes: { uomId: number; tierType: string }[] = []
    for (const key of dirtyKeys) {
      const [uomIdStr, tier] = key.split(':')
      const uomId = Number(uomIdStr)
      const val = localPrices[uomId]?.[tier as TierType]?.trim() ?? ''
      if (!val) {
        deletes.push({ uomId, tierType: tier })
        continue
      }
      try {
        const p = new Big(val)
        if (p.lt(0)) throw new Error()
        changes.push({ uomId, tierType: tier, price: p.toString() })
      } catch {
        const uomName = uomsForPricing.find((u) => u.id === uomId)?.name ?? uomId
        setErrorMsg(`Harga tidak valid: UOM ${uomName} - ${tier}`)
        setSuccessMsg(null)
        return
      }
    }

    if (deletes.length > 0) {
      const confirmed = window.confirm(
        `${deletes.length} harga akan dihapus (sel dikosongkan). Lanjutkan?`
      )
      if (!confirmed) return
    }

    setIsSaving(true)
    setErrorMsg(null)
    try {
      const res = await fetch(
        `/api/bo/master-data/products/${productId}/prices`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchId: selectedBranchId, changes, deletes }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Gagal menyimpan harga')
        setSuccessMsg(null)
      } else {
        setSuccessMsg('Harga berhasil disimpan')
        setErrorMsg(null)
        await fetchPrices(selectedBranchId)
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan')
      setSuccessMsg(null)
    } finally {
      setIsSaving(false)
    }
  }

  if (branches.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Tidak ada cabang aktif yang terdaftar. Tambahkan cabang terlebih dahulu untuk mengatur harga.
      </div>
    )
  }

  return (
    <div>
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800"
        >
          {successMsg}
        </div>
      )}
      {errorMsg && !successMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
        >
          {errorMsg}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <label htmlFor="branch-select" className="text-sm font-medium text-muted-foreground">
          Cabang:
        </label>
        <select
          id="branch-select"
          value={selectedBranchId ?? ''}
          onChange={(e) => setSelectedBranchId(Number(e.target.value))}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Memuat data harga...
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      UOM
                    </th>
                    {PRICE_TIERS.map((tier) => (
                      <th
                        key={tier}
                        className="text-left px-4 py-3 font-medium text-muted-foreground"
                      >
                        {tier}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uomsForPricing.map((uom) => (
                    <tr
                      key={uom.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {uom.name}
                        {uom.isBase && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (dasar)
                          </span>
                        )}
                      </td>
                      {PRICE_TIERS.map((tier) => (
                        <td key={tier} className="px-4 py-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={localPrices[uom.id]?.[tier] ?? ''}
                            onChange={(e) =>
                              handlePriceChange(uom.id, tier, e.target.value)
                            }
                            disabled={isSaving}
                            placeholder="—"
                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {uomsForPricing.length === 0 && (
                    <tr>
                      <td
                        colSpan={PRICE_TIERS.length + 1}
                        className="px-4 py-8 text-center text-muted-foreground text-sm"
                      >
                        Tidak ada UOM yang dikonfigurasi untuk produk ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            {Object.keys(dirty).length > 0 && !isSaving && (
              <span className="text-xs text-muted-foreground">
                {Object.keys(dirty).length} perubahan belum disimpan
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || Object.keys(dirty).length === 0}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}