'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import {
  DISPLAY_TIERS,
  type PriceRow,
  type Branch,
  type Category,
  type UomOption,
  type ProductConversion,
  type DraftUomRow,
  type RatioChangePlan,
} from './types'
import CopyBranchModal from './copy-branch-modal'
import CopyProductModal from './copy-product-modal'
import GlobalRatioConfirmDialog from './global-ratio-confirm-dialog'
import DraftUomRowView from './draft-uom-row'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return n.toLocaleString('id-ID')
}

function parsePrice(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return isNaN(n) ? null : n
}

function dirtyKey(productId: number, uomId: number, tier: string) {
  return `${productId}:${uomId}:${tier}`
}

function costKey(productId: number, uomId: number) {
  return `${productId}:${uomId}`
}

// ── Skeleton loading ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-md border border-border overflow-hidden animate-pulse">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2.5 border-b border-border min-w-[220px]">
              <div className="h-3 bg-muted rounded w-16" />
            </th>
            <th className="px-3 py-2.5 border-b border-border w-[70px]">
              <div className="h-3 bg-muted rounded w-10" />
            </th>
            {/* Konversi + Harga Modal + tiers + Aksi */}
            {Array.from({ length: 3 + DISPLAY_TIERS.length }).map((_, i) => (
              <th key={i} className="px-3 py-2.5 border-b border-border w-[120px]">
                <div className="h-3 bg-muted rounded w-16 ml-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-border last:border-0">
              <td className="px-3 py-3">
                <div className="h-3 bg-muted rounded w-40" />
              </td>
              <td className="px-3 py-3">
                <div className="h-3 bg-muted rounded w-8" />
              </td>
              {Array.from({ length: 3 + DISPLAY_TIERS.length }).map((_, i) => (
                <td key={i} className="px-3 py-3">
                  <div className="h-3 bg-muted rounded w-16 ml-auto" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Filter state tunggal — eliminasi double-fetch race ────────────────────────

interface FilterState {
  branchId: number | null
  categoryId: number | null
  search: string
  page: number
}

interface Props {
  branches: Branch[]
  categories: Category[]
}

// Kolom navigasi keyboard: Konversi (0) + Harga Modal (1) + DISPLAY_TIERS (2..N)
const TOTAL_COLS = 2 + DISPLAY_TIERS.length

export default function PricesClient({ branches, categories }: Props) {
  const [filter, setFilter] = useState<FilterState>({
    branchId: branches[0]?.id ?? null,
    categoryId: null,
    search: '',
    page: 1,
  })
  const [searchInput, setSearchInput] = useState('')

  const [rows, setRows] = useState<PriceRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [dirty, setDirty] = useState<Record<string, number>>({})
  const [dirtyCosts, setDirtyCosts] = useState<Record<string, number>>({})
  const [dirtyRatios, setDirtyRatios] = useState<Record<string, number>>({})
  const [drafts, setDrafts] = useState<DraftUomRow[]>([])
  const [allUoms, setAllUoms] = useState<UomOption[] | null>(null)
  const [loadingDraftFor, setLoadingDraftFor] = useState<number | null>(null)
  const [pendingRatioChanges, setPendingRatioChanges] = useState<RatioChangePlan[] | null>(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [copyTarget, setCopyTarget] = useState<{ productId: number; productName: string } | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  // Cache konversi per produk (untuk draft row & deteksi bentrok ratio)
  const convCache = useRef<Map<number, ProductConversion[]>>(new Map())

  useEffect(() => {
    const t = setTimeout(() => {
      setFilter(f => ({ ...f, search: searchInput, page: 1 }))
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setDirty({})
    setDirtyCosts({})
    setDirtyRatios({})
    setDrafts([])
  }, [filter.branchId])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 5000)
    return () => clearTimeout(t)
  }, [successMsg])

  const fetchData = useCallback(async () => {
    if (!filter.branchId) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setIsLoading(true)
    setErrorMsg(null)
    try {
      const params = new URLSearchParams({ branchId: String(filter.branchId), page: String(filter.page) })
      if (filter.categoryId) params.set('categoryId', String(filter.categoryId))
      if (filter.search) params.set('search', filter.search)

      const res = await fetch(`/api/bo/master-data/prices?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal memuat data')
      const json = await res.json() as { data: PriceRow[]; total: number; page: number; pageSize: number }
      setRows(json.data)
      setTotal(json.total)
      setPageSize(json.pageSize)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setErrorMsg((e as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Cell value helpers ────────────────────────────────────────────────────────

  function handleChange(productId: number, uomId: number, tier: string, value: string) {
    const key = dirtyKey(productId, uomId, tier)
    const parsed = parsePrice(value)
    if (parsed === null) {
      setDirty(d => { const n = { ...d }; delete n[key]; return n })
    } else {
      setDirty(d => ({ ...d, [key]: parsed }))
    }
  }

  function handleCostChange(productId: number, uomId: number, value: string) {
    const key = costKey(productId, uomId)
    const parsed = parsePrice(value)
    if (parsed === null) {
      setDirtyCosts(d => { const n = { ...d }; delete n[key]; return n })
    } else {
      setDirtyCosts(d => ({ ...d, [key]: parsed }))
    }
  }

  function handleRatioChange(productId: number, uomId: number, value: string) {
    const key = costKey(productId, uomId)
    const parsed = parsePrice(value)
    if (parsed === null) {
      setDirtyRatios(d => { const n = { ...d }; delete n[key]; return n })
    } else {
      setDirtyRatios(d => ({ ...d, [key]: parsed }))
    }
  }

  function getCellDisplay(row: PriceRow, tier: string): string {
    const key = dirtyKey(row.product_id, row.uom_id, tier)
    if (key in dirty) return formatPrice(dirty[key])
    const v = row.prices[tier]
    if (v === undefined || v === null) return ''
    const n = Number(v)
    return isNaN(n) ? '' : formatPrice(n)
  }

  function getCostDisplay(row: PriceRow): string {
    const key = costKey(row.product_id, row.uom_id)
    if (key in dirtyCosts) return formatPrice(dirtyCosts[key])
    if (row.cost_price === null || row.cost_price === undefined) return ''
    return formatPrice(Number(row.cost_price))
  }

  function getRatioDisplay(row: PriceRow): string {
    const key = costKey(row.product_id, row.uom_id)
    if (key in dirtyRatios) return String(dirtyRatios[key])
    return row.conversion_ratio !== null ? String(row.conversion_ratio) : ''
  }

  function isRatioDirty(row: PriceRow): boolean {
    const key = costKey(row.product_id, row.uom_id)
    return key in dirtyRatios && dirtyRatios[key] !== row.conversion_ratio
  }

  // ── Draft rows ("+ satuan") ───────────────────────────────────────────────────

  async function ensureUomAndConversions(productId: number) {
    const tasks: Promise<void>[] = []
    if (!allUoms) {
      tasks.push(
        fetch('/api/bo/master-data/uom')
          .then(async (r) => {
            if (!r.ok) throw new Error('Gagal memuat daftar satuan')
            setAllUoms(await r.json() as UomOption[])
          })
      )
    }
    if (!convCache.current.has(productId)) {
      tasks.push(
        fetch(`/api/bo/master-data/products/${productId}/uom-conversions`)
          .then(async (r) => {
            if (!r.ok) throw new Error('Gagal memuat konversi produk')
            convCache.current.set(productId, await r.json() as ProductConversion[])
          })
      )
    }
    await Promise.all(tasks)
  }

  async function addDraft(row: PriceRow) {
    setLoadingDraftFor(row.product_id)
    setErrorMsg(null)
    try {
      await ensureUomAndConversions(row.product_id)
      setDrafts(prev => [
        ...prev,
        {
          key: `${row.product_id}:${Date.now()}`,
          productId: row.product_id,
          productName: row.product_name,
          baseUomId: row.base_uom_id,
          baseUomCode: row.base_uom_code,
          uomId: null,
          newUom: null,
          ratio: '',
          prices: {},
          cost: null,
        },
      ])
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setLoadingDraftFor(null)
    }
  }

  function updateDraft(key: string, next: DraftUomRow) {
    setDrafts(prev => prev.map(d => (d.key === key ? next : d)))
  }

  function removeDraft(key: string) {
    setDrafts(prev => prev.filter(d => d.key !== key))
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const dirtyCount =
    Object.keys(dirty).length +
    Object.keys(dirtyCosts).length +
    Object.keys(dirtyRatios).length +
    drafts.length

  // Kumpulkan perubahan ratio konversi existing (global) yang butuh konfirmasi
  const collectRatioUpdates = useCallback((): RatioChangePlan[] => {
    const updates: RatioChangePlan[] = []
    for (const [key, newRatio] of Object.entries(dirtyRatios)) {
      const [pid, uid] = key.split(':').map(Number)
      const row = rows.find(r => r.product_id === pid && r.uom_id === uid)
      if (!row || row.conversion_id === null) continue
      if (row.conversion_ratio === newRatio) continue
      updates.push({
        productId: pid,
        productName: row.product_name,
        uomId: uid,
        uomCode: row.uom_code,
        conversionId: row.conversion_id,
        oldRatio: row.conversion_ratio,
        newRatio,
        branches: [],
      })
    }
    for (const draft of drafts) {
      if (draft.uomId === null || draft.newUom !== null) continue
      const conv = convCache.current.get(draft.productId)?.find(c => c.uomId === draft.uomId)
      if (!conv) continue
      const parsed = parsePrice(draft.ratio)
      if (parsed === null || parsed === conv.ratio) continue
      updates.push({
        productId: draft.productId,
        productName: draft.productName,
        uomId: draft.uomId,
        uomCode: allUoms?.find(u => u.id === draft.uomId)?.code ?? String(draft.uomId),
        conversionId: conv.id,
        oldRatio: conv.ratio,
        newRatio: parsed,
        branches: conv.priceBranches ?? [],
      })
    }
    return updates
  }, [dirtyRatios, drafts, rows, allUoms])

  const validateDrafts = useCallback((): string | null => {
    for (const draft of drafts) {
      if (draft.uomId === null && draft.newUom === null) {
        return 'Ada baris satuan baru yang belum memilih UOM'
      }
      if (draft.newUom !== null && (!draft.newUom.code.trim() || !draft.newUom.name.trim())) {
        return 'Kode dan nama satuan baru wajib diisi'
      }
      const needsRatio = draft.newUom !== null || draft.uomId !== draft.baseUomId
      if (needsRatio) {
        const parsed = parsePrice(draft.ratio)
        if (parsed === null || parsed <= 0) {
          return 'Ratio satuan baru harus lebih dari 0'
        }
      }
    }
    return null
  }, [drafts])

  const executeSave = useCallback(async (ratioUpdates: RatioChangePlan[]) => {
    if (!filter.branchId) return
    setIsSaving(true)
    setErrorMsg(null)
    try {
      let globalOps = 0

      // 1. PATCH perubahan ratio konversi existing (sudah dikonfirmasi)
      for (const upd of ratioUpdates) {
        const res = await fetch(
          `/api/bo/master-data/products/${upd.productId}/uom-conversions/${upd.conversionId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ratio: String(upd.newRatio) }),
          }
        )
        if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal mengubah ratio')
        globalOps++
      }

      // 2. Baris existing tanpa konversi (harga yatim) yang diisi rationya → buat konversi
      for (const [key, newRatio] of Object.entries(dirtyRatios)) {
        const [pid, uid] = key.split(':').map(Number)
        const row = rows.find(r => r.product_id === pid && r.uom_id === uid)
        if (!row || row.conversion_id !== null) continue
        const res = await fetch(`/api/bo/master-data/products/${pid}/uom-conversions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uomId: uid, ratio: String(newRatio) }),
        })
        if (!res.ok && res.status !== 409) {
          throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal membuat konversi')
        }
        globalOps++
      }

      // 3. Proses draft: buat UOM baru & konversi bila perlu, kumpulkan harga/modal
      const priceChanges = Object.entries(dirty).map(([key, price]) => {
        const [productId, uomId, tierType] = key.split(':')
        return { productId: Number(productId), uomId: Number(uomId), tierType, price }
      })
      const costChanges = Object.entries(dirtyCosts).map(([key, costPrice]) => {
        const [productId, uomId] = key.split(':')
        return { productId: Number(productId), uomId: Number(uomId), costPrice }
      })

      for (const draft of drafts) {
        let uomId = draft.uomId

        if (draft.newUom !== null) {
          const res = await fetch('/api/bo/master-data/uom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: draft.newUom.code.trim().toUpperCase(),
              name: draft.newUom.name.trim(),
              isBase: false,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'Gagal membuat satuan baru')
          uomId = data.id as number
        }
        if (uomId === null) continue

        if (uomId !== draft.baseUomId) {
          const conv = draft.newUom === null
            ? convCache.current.get(draft.productId)?.find(c => c.uomId === uomId)
            : undefined
          if (!conv) {
            const res = await fetch(`/api/bo/master-data/products/${draft.productId}/uom-conversions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uomId, ratio: draft.ratio }),
            })
            if (!res.ok && res.status !== 409) {
              throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal membuat konversi')
            }
            globalOps++
          }
          // Ratio berbeda dari konversi existing sudah ditangani lewat ratioUpdates (langkah 1)
        }

        for (const tier of DISPLAY_TIERS) {
          const price = draft.prices[tier]
          if (price != null) {
            priceChanges.push({ productId: draft.productId, uomId, tierType: tier, price })
          }
        }
        if (draft.cost != null) {
          costChanges.push({ productId: draft.productId, uomId, costPrice: draft.cost })
        }
      }

      // 4. Simpan harga & modal sekaligus
      let updated = 0
      if (priceChanges.length > 0 || costChanges.length > 0) {
        const res = await fetch('/api/bo/master-data/prices', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branchId: filter.branchId, changes: priceChanges, costChanges }),
        })
        if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal menyimpan')
        updated = ((await res.json()) as { updated: number }).updated
      }

      const parts: string[] = []
      if (updated > 0) parts.push(`${updated} harga/modal`)
      if (globalOps > 0) parts.push(`${globalOps} konversi satuan (global)`)
      setSuccessMsg(parts.length > 0 ? `${parts.join(' dan ')} berhasil disimpan` : 'Tidak ada perubahan')
      setDirty({})
      setDirtyCosts({})
      setDirtyRatios({})
      setDrafts([])
      convCache.current.clear()
      fetchData()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setIsSaving(false)
      setPendingRatioChanges(null)
    }
  }, [filter.branchId, dirty, dirtyCosts, dirtyRatios, drafts, rows, fetchData])

  const handleSave = useCallback(async () => {
    if (!filter.branchId || dirtyCount === 0 || isSaving) return
    const draftError = validateDrafts()
    if (draftError) {
      setErrorMsg(draftError)
      return
    }

    const ratioUpdates = collectRatioUpdates()
    if (ratioUpdates.length === 0) {
      executeSave([])
      return
    }

    // Ambil daftar cabang pemakai harga untuk tiap perubahan ratio (bahan konfirmasi)
    setErrorMsg(null)
    try {
      const productIds = [...new Set(ratioUpdates.map(u => u.productId))]
      const convByProduct = new Map<number, ProductConversion[]>()
      await Promise.all(productIds.map(async (pid) => {
        const res = await fetch(`/api/bo/master-data/products/${pid}/uom-conversions`)
        if (res.ok) convByProduct.set(pid, await res.json() as ProductConversion[])
      }))
      setPendingRatioChanges(ratioUpdates.map(u => ({
        ...u,
        branches: convByProduct.get(u.productId)?.find(c => c.uomId === u.uomId)?.priceBranches ?? u.branches,
      })))
    } catch {
      setPendingRatioChanges(ratioUpdates)
    }
  }, [filter.branchId, dirtyCount, isSaving, validateDrafts, collectRatioUpdates, executeSave])

  // Global Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (dirtyCount > 0) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirtyCount, handleSave])

  // ── Hapus per baris ───────────────────────────────────────────────────────────

  async function deleteBranchPrices(row: PriceRow) {
    if (!filter.branchId) return
    setMenuFor(null)
    const branchName = branches.find(b => b.id === filter.branchId)?.name ?? ''
    if (!window.confirm(
      `Hapus semua harga & modal satuan ${row.uom_code} untuk "${row.product_name}" di cabang ${branchName}?\n\nSatuan (konversi global) TIDAK ikut terhapus — cabang lain tidak terpengaruh.`
    )) return
    setErrorMsg(null)
    try {
      const params = new URLSearchParams({
        branchId: String(filter.branchId),
        productId: String(row.product_id),
        uomId: String(row.uom_id),
      })
      const res = await fetch(`/api/bo/master-data/prices?${params}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal menghapus harga')
      setSuccessMsg(`Harga ${row.uom_code} untuk ${row.product_name} di cabang ini dihapus`)
      fetchData()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    }
  }

  async function deleteGlobalUom(row: PriceRow) {
    if (row.conversion_id === null) return
    setMenuFor(null)
    if (!window.confirm(
      `Hapus satuan ${row.uom_code} dari "${row.product_name}" secara GLOBAL?\n\nIni menghapus konversi beserta SEMUA harga & modal satuan ini di SEMUA cabang.`
    )) return
    setErrorMsg(null)
    try {
      const url = `/api/bo/master-data/products/${row.product_id}/uom-conversions/${row.conversion_id}`
      let res = await fetch(url, { method: 'DELETE' })
      if (res.status === 409) {
        const data = await res.json() as { error: string; branches?: string[] }
        if (!window.confirm(`${data.error}\n\nYakin lanjut menghapus?`)) return
        res = await fetch(`${url}?cascade=1`, { method: 'DELETE' })
      }
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal menghapus satuan')
      setSuccessMsg(`Satuan ${row.uom_code} untuk ${row.product_name} dihapus dari semua cabang`)
      convCache.current.delete(row.product_id)
      fetchData()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    }
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────────

  function focusCell(rowIdx: number, colIdx: number) {
    if (rowIdx < 0 || rowIdx >= rows.length) return
    if (colIdx < 0 || colIdx >= TOTAL_COLS) return
    const el = cellRefs.current.get(`${rowIdx}:${colIdx}`)
    if (!el) return
    el.focus()
    requestAnimationFrame(() => el.select())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusCell(rowIdx + 1, colIdx)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusCell(rowIdx - 1, colIdx)
        break
      case 'Enter':
        e.preventDefault()
        if (rowIdx + 1 < rows.length) {
          focusCell(rowIdx + 1, colIdx)
        } else {
          focusCell(0, colIdx + 1)
        }
        break
    }
  }

  // ── Group multi-UOM ───────────────────────────────────────────────────────────

  const groupedRows = useMemo(() => {
    const groups: { rows: PriceRow[]; startIdx: number }[] = []
    const seen = new Map<number, number>()
    let idx = 0
    for (const row of rows) {
      if (!seen.has(row.product_id)) {
        seen.set(row.product_id, groups.length)
        groups.push({ rows: [], startIdx: idx })
      }
      groups[seen.get(row.product_id)!].rows.push(row)
      idx++
    }
    return groups
  }, [rows])

  // ── Render ────────────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(total / pageSize)
  const activeBranchName = branches.find(b => b.id === filter.branchId)?.name ?? ''

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          value={filter.branchId ?? ''}
          onChange={e => {
            setSearchInput('')
            setFilter({ branchId: Number(e.target.value), categoryId: null, search: '', page: 1 })
          }}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
        >
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select
          value={filter.categoryId ?? ''}
          onChange={e => setFilter(f => ({
            ...f,
            categoryId: e.target.value ? Number(e.target.value) : null,
            page: 1,
          }))}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
        >
          <option value="">Semua Kategori</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <input
          type="text"
          placeholder="Cari nama produk..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground flex-1 min-w-[200px]"
        />

        <div className="ml-auto flex items-center gap-3">
          {successMsg && (
            <span className="text-sm text-green-600 font-medium">{successMsg}</span>
          )}
          {errorMsg && (
            <span className="text-sm text-destructive">{errorMsg}</span>
          )}
          <button
            onClick={() => setShowCopyModal(true)}
            disabled={!filter.branchId}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="w-3.5 h-3.5" />
            Salin dari Cabang Lain
          </button>
          <button
            onClick={handleSave}
            disabled={dirtyCount === 0 || isSaving || !filter.branchId}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {isSaving ? 'Menyimpan...' : dirtyCount > 0 ? `Simpan (${dirtyCount})` : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Summary + shortcut hint */}
      {filter.branchId && !isLoading && total > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">
            Menampilkan {rows.length} dari {total} entri produk-UOM
            {dirtyCount > 0 && (
              <span className="ml-2 text-primary font-medium">· {dirtyCount} perubahan belum disimpan</span>
            )}
            {Object.keys(dirtyRatios).length + drafts.length > 0 && (
              <span className="ml-2 text-violet-600 font-medium">
                · kolom Konversi berlaku GLOBAL (semua cabang)
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground/70">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↑↓</kbd>
            {' '}navigasi baris{'  ·  '}
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Enter</kbd>
            {' '}baris berikutnya{'  ·  '}
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Tab</kbd>
            {' '}kolom berikutnya{'  ·  '}
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Ctrl+S</kbd>
            {' '}simpan
          </p>
        </div>
      )}

      {/* Empty / loading / error states */}
      {!filter.branchId && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Pilih cabang untuk menampilkan data harga
        </div>
      )}
      {filter.branchId && isLoading && <TableSkeleton />}
      {filter.branchId && !isLoading && errorMsg && rows.length === 0 && (
        <div className="text-center py-16 text-sm text-destructive">{errorMsg}</div>
      )}
      {filter.branchId && !isLoading && !errorMsg && rows.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">Tidak ada data harga ditemukan</div>
      )}

      {/* Tabel harga */}
      {filter.branchId && !isLoading && rows.length > 0 && (
        <>
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground min-w-[220px] border-b border-border">
                    Produk
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[110px] border-b border-border">
                    UOM
                  </th>
                  <th
                    className="text-left px-3 py-2.5 font-medium text-violet-600 w-[130px] border-b border-border"
                    title="Ratio konversi bersifat GLOBAL — berlaku untuk semua cabang"
                  >
                    Konversi <span className="text-[10px] font-normal">(global)</span>
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium text-amber-600 w-[130px] border-b border-border">
                    Harga Modal
                  </th>
                  {DISPLAY_TIERS.map(tier => (
                    <th key={tier} className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[130px] border-b border-border">
                      {tier}
                    </th>
                  ))}
                  <th className="px-2 py-2.5 w-[44px] border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(({ rows: uomRows, startIdx }) => {
                  const productDrafts = drafts.filter(d => d.productId === uomRows[0].product_id)
                  const groupSpan = uomRows.length + productDrafts.length
                  const isMultiUom = uomRows.length > 1
                  return [
                    ...uomRows.map((row, uomIdx) => {
                      const rowIdx = startIdx + uomIdx
                      const isLastInGroup = uomIdx === uomRows.length - 1 && productDrafts.length === 0
                      const isCostDirty = costKey(row.product_id, row.uom_id) in dirtyCosts
                      const isBaseUom = row.uom_id === row.base_uom_id
                      const rowKey = `${row.product_id}:${row.uom_id}`

                      return (
                        <tr
                          key={rowKey}
                          className="hover:bg-muted/20 transition-colors"
                          style={{ borderBottom: isLastInGroup ? '1px solid var(--border)' : undefined }}
                        >
                          {/* Nama produk: rowSpan untuk multi-UOM + draft */}
                          {uomIdx === 0 && (
                            <td
                              rowSpan={groupSpan}
                              className="px-3 align-middle border-b border-border"
                              style={{ borderRight: groupSpan > 1 ? '1px solid var(--border)' : undefined }}
                            >
                              <span className="block font-medium text-foreground truncate max-w-[210px]">
                                {row.product_name}
                              </span>
                              <span className="flex items-center gap-2">
                                {isMultiUom && (
                                  <span className="text-xs text-muted-foreground">{uomRows.length} UOM</span>
                                )}
                                <button
                                  onClick={() => addDraft(row)}
                                  disabled={loadingDraftFor === row.product_id || isSaving}
                                  title="Tambah satuan baru untuk produk ini (konversi berlaku semua cabang)"
                                  className="text-xs text-primary/70 hover:text-primary hover:underline disabled:opacity-50"
                                >
                                  {loadingDraftFor === row.product_id ? 'memuat...' : '+ satuan'}
                                </button>
                                <button
                                  onClick={() => setCopyTarget({ productId: row.product_id, productName: row.product_name })}
                                  disabled={isSaving}
                                  title="Salin satuan & harga dari produk lain"
                                  className="text-xs text-primary/70 hover:text-primary hover:underline disabled:opacity-50"
                                >
                                  salin
                                </button>
                              </span>
                            </td>
                          )}

                          {/* UOM code */}
                          <td className={[
                            'px-3 py-1.5 text-muted-foreground font-mono text-xs',
                            isMultiUom && uomIdx > 0 ? 'pl-5 text-muted-foreground/70' : '',
                          ].join(' ')}>
                            {row.uom_code}
                          </td>

                          {/* Konversi (ratio global) — colIdx 0 */}
                          <td className="px-2 py-1">
                            {isBaseUom ? (
                              <span className="text-xs text-muted-foreground px-2">dasar</span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">=</span>
                                <input
                                  ref={el => {
                                    if (el) cellRefs.current.set(`${rowIdx}:0`, el)
                                    else cellRefs.current.delete(`${rowIdx}:0`)
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  value={getRatioDisplay(row)}
                                  placeholder="—"
                                  onChange={e => handleRatioChange(row.product_id, row.uom_id, e.target.value)}
                                  onFocus={e => e.target.select()}
                                  onKeyDown={e => handleKeyDown(e, rowIdx, 0)}
                                  className={[
                                    'w-14 text-right px-1.5 py-1 rounded border text-sm transition-colors',
                                    isRatioDirty(row)
                                      ? 'border-violet-400 bg-violet-50 font-medium text-violet-700'
                                      : 'border-transparent bg-transparent hover:border-border focus:border-violet-400',
                                    'focus:outline-none',
                                  ].join(' ')}
                                />
                                <span className="text-[10px] text-muted-foreground">{row.base_uom_code}</span>
                              </span>
                            )}
                          </td>

                          {/* Harga Modal — colIdx 1 */}
                          <td className="px-2 py-1">
                            <input
                              ref={el => {
                                if (el) cellRefs.current.set(`${rowIdx}:1`, el)
                                else cellRefs.current.delete(`${rowIdx}:1`)
                              }}
                              type="text"
                              inputMode="numeric"
                              value={getCostDisplay(row)}
                              placeholder="—"
                              onChange={e => handleCostChange(row.product_id, row.uom_id, e.target.value)}
                              onFocus={e => e.target.select()}
                              onKeyDown={e => handleKeyDown(e, rowIdx, 1)}
                              className={[
                                'w-full text-right px-2 py-1 rounded border text-sm transition-colors',
                                isCostDirty
                                  ? 'border-amber-400 bg-amber-50 font-medium text-amber-700'
                                  : 'border-transparent bg-transparent hover:border-border focus:border-amber-400',
                                'focus:outline-none',
                              ].join(' ')}
                            />
                          </td>

                          {/* Cell harga per tier — colIdx 2..N */}
                          {DISPLAY_TIERS.map((tier, tierIdx) => {
                            const colIdx = 2 + tierIdx
                            const key = dirtyKey(row.product_id, row.uom_id, tier)
                            const isDirty = key in dirty
                            return (
                              <td key={tier} className="px-2 py-1">
                                <input
                                  ref={el => {
                                    if (el) cellRefs.current.set(`${rowIdx}:${colIdx}`, el)
                                    else cellRefs.current.delete(`${rowIdx}:${colIdx}`)
                                  }}
                                  type="text"
                                  inputMode="numeric"
                                  value={getCellDisplay(row, tier)}
                                  placeholder="—"
                                  onChange={e => handleChange(row.product_id, row.uom_id, tier, e.target.value)}
                                  onFocus={e => e.target.select()}
                                  onKeyDown={e => handleKeyDown(e, rowIdx, colIdx)}
                                  className={[
                                    'w-full text-right px-2 py-1 rounded border text-sm transition-colors',
                                    isDirty
                                      ? 'border-primary bg-primary/5 font-medium text-primary'
                                      : 'border-transparent bg-transparent hover:border-border focus:border-primary',
                                    'focus:outline-none',
                                  ].join(' ')}
                                />
                              </td>
                            )
                          })}

                          {/* Aksi hapus */}
                          <td className="px-2 py-1 text-center relative">
                            <button
                              onClick={() => setMenuFor(menuFor === rowKey ? null : rowKey)}
                              disabled={isSaving}
                              title="Hapus harga / satuan"
                              className="text-muted-foreground/50 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {menuFor === rowKey && (
                              <>
                                <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                                <div className="absolute right-8 top-1 z-30 w-56 bg-background border border-border rounded-md shadow-lg text-left">
                                  <button
                                    onClick={() => deleteBranchPrices(row)}
                                    className="block w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                                  >
                                    Hapus harga <strong>cabang {activeBranchName}</strong>
                                    <span className="block text-muted-foreground">Satuan &amp; cabang lain tidak terpengaruh</span>
                                  </button>
                                  {row.conversion_id !== null && (
                                    <button
                                      onClick={() => deleteGlobalUom(row)}
                                      className="block w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors border-t border-border"
                                    >
                                      Hapus satuan <strong>GLOBAL</strong>
                                      <span className="block text-destructive/70">Konversi + harga di SEMUA cabang</span>
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    }),
                    ...productDrafts.map(draft => (
                      <DraftUomRowView
                        key={draft.key}
                        draft={draft}
                        allUoms={allUoms ?? []}
                        usedUomIds={uomRows.map(r => r.uom_id)}
                        conversions={convCache.current.get(draft.productId) ?? []}
                        disabled={isSaving}
                        onChange={next => updateDraft(draft.key, next)}
                        onRemove={() => removeDraft(draft.key)}
                      />
                    )),
                  ]
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Halaman {filter.page} dari {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setFilter(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
              disabled={filter.page === 1}
              className="px-3 py-1.5 text-xs border border-border rounded-md disabled:opacity-40 hover:bg-muted/50 transition-colors"
            >
              ← Sebelumnya
            </button>
            <button
              onClick={() => setFilter(f => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
              disabled={filter.page === totalPages}
              className="px-3 py-1.5 text-xs border border-border rounded-md disabled:opacity-40 hover:bg-muted/50 transition-colors"
            >
              Selanjutnya →
            </button>
          </div>
        </div>
      )}

      {/* Dialog konfirmasi perubahan ratio global */}
      {pendingRatioChanges && (
        <GlobalRatioConfirmDialog
          changes={pendingRatioChanges}
          isSaving={isSaving}
          onCancel={() => setPendingRatioChanges(null)}
          onConfirm={() => executeSave(pendingRatioChanges)}
        />
      )}

      {/* Modal salin satuan & harga dari produk lain */}
      {copyTarget && filter.branchId && (
        <CopyProductModal
          targetProductId={copyTarget.productId}
          targetProductName={copyTarget.productName}
          branchId={filter.branchId}
          branchName={activeBranchName}
          displayTiers={DISPLAY_TIERS}
          onClose={() => setCopyTarget(null)}
          onSuccess={(summary) => {
            setCopyTarget(null)
            setSuccessMsg(summary)
            convCache.current.clear()
            fetchData()
          }}
        />
      )}

      {/* Modal salin harga antar cabang */}
      {showCopyModal && filter.branchId && (
        <CopyBranchModal
          branches={branches}
          targetBranchId={filter.branchId}
          targetBranchName={activeBranchName}
          onClose={() => setShowCopyModal(false)}
          onSuccess={(copied) => {
            setShowCopyModal(false)
            setSuccessMsg(`${copied} harga berhasil disalin`)
            fetchData()
          }}
        />
      )}
    </div>
  )
}
