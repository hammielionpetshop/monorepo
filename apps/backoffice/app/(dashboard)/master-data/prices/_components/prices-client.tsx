'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Copy } from 'lucide-react'
import { DISPLAY_TIERS, type PriceRow, type Branch, type Category } from './types'
import CopyBranchModal from './copy-branch-modal'

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
            {/* Harga Modal + 4 tiers */}
            {Array.from({ length: 1 + DISPLAY_TIERS.length }).map((_, i) => (
              <th key={i} className="px-3 py-2.5 border-b border-border w-[140px]">
                <div className="h-3 bg-muted rounded w-20 ml-auto" />
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
              {Array.from({ length: 1 + DISPLAY_TIERS.length }).map((_, i) => (
                <td key={i} className="px-3 py-3">
                  <div className="h-3 bg-muted rounded w-20 ml-auto" />
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

// Total kolom: Harga Modal (0) + DISPLAY_TIERS (1..N)
const TOTAL_COLS = 1 + DISPLAY_TIERS.length

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
  const [showCopyModal, setShowCopyModal] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  useEffect(() => {
    const t = setTimeout(() => {
      setFilter(f => ({ ...f, search: searchInput, page: 1 }))
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setDirty({})
    setDirtyCosts({})
  }, [filter.branchId])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
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

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const hasChanges = Object.keys(dirty).length > 0
    const hasCostChanges = Object.keys(dirtyCosts).length > 0
    if (!filter.branchId || (!hasChanges && !hasCostChanges)) return

    setIsSaving(true)
    setErrorMsg(null)
    try {
      const changes = Object.entries(dirty).map(([key, price]) => {
        const [productId, uomId, tierType] = key.split(':')
        return { productId: Number(productId), uomId: Number(uomId), tierType, price }
      })
      const costChanges = Object.entries(dirtyCosts).map(([key, costPrice]) => {
        const [productId, uomId] = key.split(':')
        return { productId: Number(productId), uomId: Number(uomId), costPrice }
      })

      const res = await fetch('/api/bo/master-data/prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: filter.branchId, changes, costChanges }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal menyimpan')
      const json = await res.json() as { updated: number }
      setSuccessMsg(`${json.updated} perubahan berhasil disimpan`)
      setDirty({})
      setDirtyCosts({})
      fetchData()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [filter.branchId, dirty, dirtyCosts, fetchData])

  // Global Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        const hasChanges = Object.keys(dirty).length > 0 || Object.keys(dirtyCosts).length > 0
        if (hasChanges) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, dirtyCosts, handleSave])

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

  const dirtyCount = Object.keys(dirty).length + Object.keys(dirtyCosts).length
  const totalPages = Math.ceil(total / pageSize)

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
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-[70px] border-b border-border">
                    UOM
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium text-amber-600 w-[140px] border-b border-border">
                    Harga Modal
                  </th>
                  {DISPLAY_TIERS.map(tier => (
                    <th key={tier} className="text-right px-3 py-2.5 font-medium text-muted-foreground w-[140px] border-b border-border">
                      {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(({ rows: uomRows, startIdx }) => {
                  const isMultiUom = uomRows.length > 1
                  return uomRows.map((row, uomIdx) => {
                    const rowIdx = startIdx + uomIdx
                    const isLastInGroup = uomIdx === uomRows.length - 1
                    const isCostDirty = costKey(row.product_id, row.uom_id) in dirtyCosts

                    return (
                      <tr
                        key={`${row.product_id}:${row.uom_id}`}
                        className="hover:bg-muted/20 transition-colors"
                        style={{ borderBottom: isLastInGroup ? '1px solid var(--border)' : undefined }}
                      >
                        {/* Nama produk: rowSpan untuk multi-UOM */}
                        {uomIdx === 0 && (
                          <td
                            rowSpan={uomRows.length}
                            className="px-3 align-middle border-b border-border"
                            style={{ borderRight: isMultiUom ? '1px solid var(--border)' : undefined }}
                          >
                            <span className="block font-medium text-foreground truncate max-w-[210px]">
                              {row.product_name}
                            </span>
                            {isMultiUom && (
                              <span className="text-xs text-muted-foreground">{uomRows.length} UOM</span>
                            )}
                          </td>
                        )}

                        {/* UOM code */}
                        <td className={[
                          'px-3 py-1.5 text-muted-foreground font-mono text-xs',
                          isMultiUom && uomIdx > 0 ? 'pl-5 text-muted-foreground/70' : '',
                        ].join(' ')}>
                          {row.uom_code}
                        </td>

                        {/* Harga Modal — colIdx 0 */}
                        <td className="px-2 py-1">
                          <input
                            ref={el => {
                              if (el) cellRefs.current.set(`${rowIdx}:0`, el)
                              else cellRefs.current.delete(`${rowIdx}:0`)
                            }}
                            type="text"
                            inputMode="numeric"
                            value={getCostDisplay(row)}
                            placeholder="—"
                            onChange={e => handleCostChange(row.product_id, row.uom_id, e.target.value)}
                            onFocus={e => e.target.select()}
                            onKeyDown={e => handleKeyDown(e, rowIdx, 0)}
                            className={[
                              'w-full text-right px-2 py-1 rounded border text-sm transition-colors',
                              isCostDirty
                                ? 'border-amber-400 bg-amber-50 font-medium text-amber-700'
                                : 'border-transparent bg-transparent hover:border-border focus:border-amber-400',
                              'focus:outline-none',
                            ].join(' ')}
                          />
                        </td>

                        {/* Cell harga per tier — colIdx 1..N */}
                        {DISPLAY_TIERS.map((tier, tierIdx) => {
                          const colIdx = 1 + tierIdx
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
                      </tr>
                    )
                  })
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

      {/* Modal salin harga antar cabang */}
      {showCopyModal && filter.branchId && (
        <CopyBranchModal
          branches={branches}
          targetBranchId={filter.branchId}
          targetBranchName={branches.find(b => b.id === filter.branchId)?.name ?? ''}
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
