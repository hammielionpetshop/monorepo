'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Copy } from 'lucide-react'
import { DISPLAY_TIERS, type PriceRow, type Branch, type Category } from './types'
import CopyBranchModal from './copy-branch-modal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return n.toLocaleString('id-ID')
}

// Strip semua karakter non-digit, lalu parse integer.
// Handles: "150.000", "150,000", "150000", copy-paste dari spreadsheet, dll.
function parsePrice(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return isNaN(n) ? null : n
}

function dirtyKey(productId: number, uomId: number, tier: string) {
  return `${productId}:${uomId}:${tier}`
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

export default function PricesClient({ branches, categories }: Props) {
  const [filter, setFilter] = useState<FilterState>({
    branchId: branches[0]?.id ?? null,
    categoryId: null,
    search: '',
    page: 1,
  })
  // searchInput terpisah dari filter.search agar debounce tidak trigger fetch tiap ketikan
  const [searchInput, setSearchInput] = useState('')

  const [rows, setRows] = useState<PriceRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [dirty, setDirty] = useState<Record<string, number>>({})
  const [showCopyModal, setShowCopyModal] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  // Map "rowIdx:colIdx" → input element untuk keyboard navigation
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Debounce: update filter.search + reset page secara atomik — satu setState, satu fetch
  useEffect(() => {
    const t = setTimeout(() => {
      setFilter(f => ({ ...f, search: searchInput, page: 1 }))
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset dirty saat ganti cabang
  useEffect(() => { setDirty({}) }, [filter.branchId])

  // Auto-dismiss pesan sukses
  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  // Fetch bergantung pada satu objek `filter` — tidak ada race antara page dan search
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

  function getCellDisplay(row: PriceRow, tier: string): string {
    const key = dirtyKey(row.product_id, row.uom_id, tier)
    if (key in dirty) return formatPrice(dirty[key])
    const v = row.prices[tier]
    if (v === undefined || v === null) return ''
    const n = Number(v)
    return isNaN(n) ? '' : formatPrice(n)
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!filter.branchId || Object.keys(dirty).length === 0) return
    setIsSaving(true)
    setErrorMsg(null)
    try {
      const changes = Object.entries(dirty).map(([key, price]) => {
        const [productId, uomId, tierType] = key.split(':')
        return { productId: Number(productId), uomId: Number(uomId), tierType, price }
      })
      const res = await fetch('/api/bo/master-data/prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: filter.branchId, changes }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal menyimpan')
      const json = await res.json() as { updated: number }
      setSuccessMsg(`${json.updated} harga berhasil disimpan`)
      setDirty({})
      fetchData()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setIsSaving(false)
    }
  }, [filter.branchId, dirty, fetchData])

  // Global Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (Object.keys(dirty).length > 0) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, handleSave])

  // ── Keyboard navigation ───────────────────────────────────────────────────────

  function focusCell(rowIdx: number, colIdx: number) {
    if (rowIdx < 0 || rowIdx >= rows.length) return
    if (colIdx < 0 || colIdx >= DISPLAY_TIERS.length) return
    const el = cellRefs.current.get(`${rowIdx}:${colIdx}`)
    if (!el) return
    el.focus()
    // requestAnimationFrame agar select terjadi setelah React re-render value baru
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
        // Enter turun baris; jika baris terakhir, pindah ke kolom berikutnya baris pertama
        if (rowIdx + 1 < rows.length) {
          focusCell(rowIdx + 1, colIdx)
        } else {
          focusCell(0, colIdx + 1)
        }
        break
      // Tab dibiarkan default — browser sudah navigasi sesuai DOM order
    }
  }

  // ── Group multi-UOM ───────────────────────────────────────────────────────────

  const groupedRows = useMemo(() => {
    const groups: { rows: PriceRow[]; startIdx: number }[] = []
    const seen = new Map<number, number>() // productId → index dalam groups
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

  const dirtyCount = Object.keys(dirty).length
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

      {/* Summary */}
      {filter.branchId && !isLoading && total > 0 && (
        <p className="text-xs text-muted-foreground mb-3">
          Menampilkan {rows.length} dari {total} entri produk-UOM
          {dirtyCount > 0 && (
            <span className="ml-2 text-primary font-medium">· {dirtyCount} perubahan belum disimpan</span>
          )}
        </p>
      )}

      {/* Empty states */}
      {!filter.branchId && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Pilih cabang untuk menampilkan data harga
        </div>
      )}
      {filter.branchId && isLoading && (
        <div className="text-center py-16 text-muted-foreground text-sm">Memuat data...</div>
      )}
      {filter.branchId && !isLoading && rows.length === 0 && (
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

                        {/* UOM code — indent jika multi-UOM baris ke-2+ */}
                        <td className={[
                          'px-3 py-1.5 text-muted-foreground font-mono text-xs',
                          isMultiUom && uomIdx > 0 ? 'pl-5 text-muted-foreground/70' : '',
                        ].join(' ')}>
                          {row.uom_code}
                        </td>

                        {/* Cell harga per tier */}
                        {DISPLAY_TIERS.map((tier, colIdx) => {
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

          {/* Keyboard shortcut hint */}
          <p className="text-xs text-muted-foreground mt-1.5">
            ↑↓ / Enter: navigasi baris · Tab: navigasi kolom · Ctrl+S: simpan
          </p>
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
