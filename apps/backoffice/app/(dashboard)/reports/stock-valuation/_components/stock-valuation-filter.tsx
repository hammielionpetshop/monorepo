'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export interface RefOption {
  id: number
  name: string
}

const SORT_OPTIONS = [
  { value: 'branch', label: 'Cabang, lalu nama produk' },
  { value: 'value_desc', label: 'Nilai FIFO terbesar' },
  { value: 'value_asc', label: 'Nilai FIFO terkecil' },
  { value: 'qty_desc', label: 'Stok terbanyak' },
  { value: 'name', label: 'Nama produk A–Z' },
]

export default function StockValuationFilter({
  branches,
  categories,
  brands,
  defaultBranchId,
  defaultCategoryId,
  defaultBrandId,
  defaultSearch,
  defaultMinValue,
  defaultIncludeInactive,
  defaultSort,
}: {
  branches: RefOption[]
  categories: RefOption[]
  brands: RefOption[]
  defaultBranchId?: string
  defaultCategoryId?: string
  defaultBrandId?: string
  defaultSearch?: string
  defaultMinValue?: string
  defaultIncludeInactive?: boolean
  defaultSort?: string
}) {
  const router = useRouter()
  const [branchId, setBranchId] = useState(defaultBranchId ?? '')
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '')
  const [brandId, setBrandId] = useState(defaultBrandId ?? '')
  const [search, setSearch] = useState(defaultSearch ?? '')
  const [minValue, setMinValue] = useState(defaultMinValue ?? '')
  const [includeInactive, setIncludeInactive] = useState(defaultIncludeInactive ?? false)
  const [sort, setSort] = useState(defaultSort ?? 'branch')

  function submit() {
    const params = new URLSearchParams()
    if (branchId) params.set('branchId', branchId)
    if (categoryId) params.set('categoryId', categoryId)
    if (brandId) params.set('brandId', brandId)
    if (search.trim()) params.set('search', search.trim())
    if (minValue.trim()) params.set('minValue', minValue.trim())
    if (includeInactive) params.set('includeInactive', '1')
    if (sort && sort !== 'branch') params.set('sort', sort)
    const query = params.toString()
    router.push(query ? `?${query}` : '?')
  }

  function reset() {
    setBranchId('')
    setCategoryId('')
    setBrandId('')
    setSearch('')
    setMinValue('')
    setIncludeInactive(false)
    setSort('branch')
    router.push('?')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="bg-card rounded-lg border border-border p-5 shadow-xs"
    >
      <div className="flex flex-wrap gap-6 items-end">
        <div className="flex flex-col gap-1.5 min-w-[14rem] flex-1">
          <label htmlFor="search" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Cari Produk / SKU
          </label>
          <input
            id="search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama produk atau SKU"
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="branchId" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Cabang
          </label>
          <select
            id="branchId"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            <option value="">-- Semua cabang --</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Kategori
          </label>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            <option value="">-- Semua kategori --</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="brandId" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Brand
          </label>
          <select
            id="brandId"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            <option value="">-- Semua brand --</option>
            {brands.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="minValue" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Nilai Minimum (Rp)
          </label>
          <input
            id="minValue"
            type="number"
            min="0"
            step="1"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
            placeholder="0"
            className="w-40 bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="sort" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Urutkan
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-card-foreground pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Sertakan produk nonaktif
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-5 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:opacity-90 transition-all shadow-sm"
          >
            Terapkan Filter
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  )
}
