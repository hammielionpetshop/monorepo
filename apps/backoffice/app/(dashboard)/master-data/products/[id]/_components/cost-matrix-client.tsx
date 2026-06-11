'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Big from 'big.js'

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

interface CostEntry {
  uomId: number
  costPrice: number
}

interface Props {
  productId: number
  branches: BranchOption[]
  uomsForPricing: UomForPricing[]
}

type LocalCosts = Record<number, string>

export default function CostMatrixClient({ productId, branches, uomsForPricing }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(branches[0]?.id ?? null)
  const [localCosts, setLocalCosts] = useState<LocalCosts>({})
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

  const fetchCosts = useCallback(async (branchId: number) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setLocalCosts({})
    setErrorMsg(null)
    try {
      const res = await fetch(
        `/api/bo/master-data/products/${productId}/costs?branchId=${branchId}`,
        { signal: controller.signal }
      )
      if (!res.ok) {
        setErrorMsg('Gagal mengambil data harga modal')
        return
      }

      const data: CostEntry[] = await res.json()
      const map: LocalCosts = {}
      for (const entry of data) {
        map[entry.uomId] = String(entry.costPrice)
      }
      setLocalCosts(map)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setErrorMsg('Terjadi kesalahan jaringan saat mengambil harga modal')
    } finally {
      setIsLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (selectedBranchId !== null) fetchCosts(selectedBranchId)
    else setLocalCosts({})
  }, [selectedBranchId, fetchCosts])

  function handleCostChange(uomId: number, value: string) {
    setLocalCosts((prev) => ({ ...prev, [uomId]: value }))
  }

  async function handleSave() {
    if (!selectedBranchId || isSaving) return

    const rows: { uomId: number; costPrice: string }[] = []
    for (const uom of uomsForPricing) {
      const value = localCosts[uom.id]?.trim() ?? ''
      if (!value) continue

      try {
        const cost = new Big(value)
        if (!cost.round(0).eq(cost) || cost.lt(0)) throw new Error()
        rows.push({ uomId: uom.id, costPrice: cost.toString() })
      } catch {
        setErrorMsg(`Harga modal tidak valid: UOM ${uom.name}`)
        setSuccessMsg(null)
        return
      }
    }

    if (rows.length === 0) {
      const confirmed = window.confirm(
        'Semua sel harga modal kosong. Melanjutkan akan menghapus semua harga modal untuk cabang ini. Yakin?'
      )
      if (!confirmed) return
    }

    setIsSaving(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/master-data/products/${productId}/costs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: selectedBranchId, costs: rows }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Gagal menyimpan harga modal')
        setSuccessMsg(null)
        return
      }

      setSuccessMsg('Harga modal berhasil disimpan')
      setErrorMsg(null)
      await fetchCosts(selectedBranchId)
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
        Tidak ada cabang aktif yang terdaftar. Tambahkan cabang terlebih dahulu untuk mengatur harga modal.
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
        <label htmlFor="cost-branch-select" className="text-sm font-medium text-muted-foreground">
          Cabang:
        </label>
        <select
          id="cost-branch-select"
          value={selectedBranchId ?? ''}
          onChange={(e) => setSelectedBranchId(Number(e.target.value))}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Memuat data harga modal...
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
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Rasio ke UOM dasar
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Harga Modal
                    </th>
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
                        <div className="text-xs text-muted-foreground">{uom.code}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {uom.ratio}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={localCosts[uom.id] ?? ''}
                          onChange={(e) => handleCostChange(uom.id, e.target.value)}
                          disabled={isSaving}
                          placeholder="0"
                          className="w-36 px-2 py-1.5 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              Harga modal disimpan per cabang dan per UOM. Nilai ini belum mengubah stok, laporan, atau POS pada milestone ini.
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Harga Modal'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
