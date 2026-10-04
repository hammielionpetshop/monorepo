'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProductOption } from '@/components/ui/product-select'
import { ProductMultiSelect } from '@/components/ui/product-multi-select'
import { PERIOD_RANGES } from '@/lib/date-ranges'
import {
  SALES_PRICE_TIERS,
  SALES_PRICE_TIER_LABELS,
  buildSalesByProductSearch,
  type SalesByProductQuery,
  type SalesPriceTier,
} from '@/lib/services/sales-by-product-filter'

export interface BranchOption {
  id: number
  name: string
}

export interface NamedOption {
  id: number
  name: string
}

export interface FilterProductOption extends ProductOption {
  categoryId: number | null
  brandId: number | null
}

interface CustomerOption {
  id: number
  name: string
  phone: string | null
}

const selectClass =
  'bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all'

function matchesMaster(p: FilterProductOption, categoryId: string, brandId: string): boolean {
  return (!categoryId || String(p.categoryId) === categoryId) && (!brandId || String(p.brandId) === brandId)
}

export default function FilterClient({
  products,
  branches,
  categories,
  brands,
  defaultStartDate,
  defaultEndDate,
  defaultQuery,
  defaultCustomerName,
}: {
  products: FilterProductOption[]
  branches: BranchOption[]
  categories: NamedOption[]
  brands: NamedOption[]
  defaultStartDate?: string
  defaultEndDate?: string
  defaultQuery: SalesByProductQuery
  defaultCustomerName?: string | null
}) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [endDate, setEndDate] = useState(defaultEndDate ?? '')
  const [productIds, setProductIds] = useState<string[]>(defaultQuery.productIds.map(String))
  const [categoryId, setCategoryId] = useState(defaultQuery.categoryId != null ? String(defaultQuery.categoryId) : '')
  const [brandId, setBrandId] = useState(defaultQuery.brandId != null ? String(defaultQuery.brandId) : '')
  const [priceTier, setPriceTier] = useState<SalesPriceTier | ''>(defaultQuery.priceTier ?? '')
  const [branchId, setBranchId] = useState(defaultQuery.branchId != null ? String(defaultQuery.branchId) : '')
  const [customerId, setCustomerId] = useState(defaultQuery.customerId != null ? String(defaultQuery.customerId) : '')
  const [customerQuery, setCustomerQuery] = useState(defaultCustomerName ?? '')
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visibleProducts = products.filter((p) => matchesMaster(p, categoryId, brandId))

  function submit(start: string, end: string) {
    if (!start || !end) return
    const params = buildSalesByProductSearch({
      productIds: productIds.map(Number),
      categoryId: categoryId ? Number(categoryId) : null,
      brandId: brandId ? Number(brandId) : null,
      priceTier: priceTier || null,
      branchId: branchId ? Number(branchId) : null,
      customerId: customerId ? Number(customerId) : null,
    })
    params.set('startDate', start)
    params.set('endDate', end)
    router.push(`?${params.toString()}`)
  }

  function applyRange(start: string, end: string) {
    setStartDate(start)
    setEndDate(end)
    submit(start, end)
  }

  /** Produk terpilih yang tidak cocok dengan kategori/brand baru dibuang, supaya hasilnya tidak kosong diam-diam. */
  function pruneProducts(nextCategoryId: string, nextBrandId: string) {
    const allowed = new Set(
      products.filter((p) => matchesMaster(p, nextCategoryId, nextBrandId)).map((p) => String(p.id))
    )
    setProductIds((ids) => ids.filter((id) => allowed.has(id)))
  }

  const searchCustomers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([])
      setShowCustomerDropdown(false)
      return
    }
    setIsSearchingCustomers(true)
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=8`)
      const json = await res.json()
      setCustomerResults(res.ok && Array.isArray(json) ? json : [])
      setShowCustomerDropdown(true)
    } catch {
      setCustomerResults([])
      setShowCustomerDropdown(false)
    } finally {
      setIsSearchingCustomers(false)
    }
  }, [])

  useEffect(() => {
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current)
    if (customerId) return
    customerDebounceRef.current = setTimeout(() => searchCustomers(customerQuery), 300)
    return () => {
      if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current)
    }
  }, [customerQuery, customerId, searchCustomers])

  function selectCustomer(c: CustomerOption) {
    setCustomerId(String(c.id))
    setCustomerQuery(c.name)
    setCustomerResults([])
    setShowCustomerDropdown(false)
  }

  function clearCustomer() {
    setCustomerId('')
    setCustomerQuery('')
    setCustomerResults([])
    setShowCustomerDropdown(false)
  }

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
      {/* Predefined range buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PERIOD_RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => { const { start, end } = r.getRange(); applyRange(start, end) }}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            {r.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(startDate, endDate) }}
        className="flex flex-wrap gap-6 items-end"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startDate" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Tanggal Mulai
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={selectClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endDate" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Tanggal Selesai
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className={selectClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="branchId" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Toko (opsional)
          </label>
          <select
            id="branchId"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={selectClass}
          >
            <option value="">-- Semua toko --</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="priceTier" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Jenis Transaksi
          </label>
          <select
            id="priceTier"
            value={priceTier}
            onChange={(e) => setPriceTier(e.target.value as SalesPriceTier | '')}
            className={selectClass}
          >
            <option value="">-- Semua jenis --</option>
            {SALES_PRICE_TIERS.map((t) => (
              <option key={t} value={t}>{SALES_PRICE_TIER_LABELS[t]}</option>
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
            onChange={(e) => { setCategoryId(e.target.value); pruneProducts(e.target.value, brandId) }}
            className={selectClass}
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
            onChange={(e) => { setBrandId(e.target.value); pruneProducts(categoryId, e.target.value) }}
            className={selectClass}
          >
            <option value="">-- Semua brand --</option>
            {brands.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[16rem] flex-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Produk (bisa pilih beberapa)
          </label>
          <ProductMultiSelect
            products={visibleProducts}
            value={productIds}
            onChange={setProductIds}
            placeholder="-- Semua produk --"
          />
        </div>
        <div className="relative flex flex-col gap-1.5 min-w-[14rem]">
          <label htmlFor="customerQuery" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Pelanggan (opsional)
          </label>
          <div className="flex items-center border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all">
            <input
              id="customerQuery"
              type="text"
              value={customerQuery}
              onChange={(e) => { setCustomerQuery(e.target.value); setCustomerId('') }}
              onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
              onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
              autoComplete="off"
              placeholder="-- Semua pelanggan --"
              className="w-full px-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {customerQuery && (
              <button
                type="button"
                onClick={clearCustomer}
                className="pr-2 text-muted-foreground hover:text-foreground shrink-0"
                tabIndex={-1}
                aria-label="Hapus pelanggan"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            )}
          </div>
          {isSearchingCustomers && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md px-3 py-2 text-xs text-muted-foreground">
              Mencari...
            </div>
          )}
          {!isSearchingCustomers && showCustomerDropdown && customerResults.length > 0 && (
            <ul className="absolute z-50 top-full mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md text-sm">
              {customerResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                  >
                    <div>{c.name}</div>
                    {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="submit"
          className="px-5 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:opacity-90 transition-all shadow-sm"
        >
          Hasilkan Laporan
        </button>
      </form>
    </div>
  )
}
