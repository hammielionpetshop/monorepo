'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ProductSelect, type ProductOption } from '@/components/ui/product-select'

export interface BranchOption {
  id: number
  name: string
}

const RANGES = [
  { label: 'Hari Ini', getRange: () => { const t = today(); return { start: t, end: t } } },
  { label: 'Kemarin', getRange: () => { const y = yesterday(); return { start: y, end: y } } },
  { label: 'Minggu Ini', getRange: () => ({ start: startOfWeek(), end: today() }) },
  { label: 'Bulan Ini', getRange: () => ({ start: startOfMonth(), end: today() }) },
]

function today() {
  return toLocalISO(new Date())
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toLocalISO(d)
}

function startOfWeek() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalISO(d)
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  return toLocalISO(d)
}

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function FilterClient({
  products,
  branches,
  defaultStartDate,
  defaultEndDate,
  defaultProductId,
  defaultBranchId,
}: {
  products: ProductOption[]
  branches: BranchOption[]
  defaultStartDate?: string
  defaultEndDate?: string
  defaultProductId?: string
  defaultBranchId?: string
}) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [endDate, setEndDate] = useState(defaultEndDate ?? '')
  const [productId, setProductId] = useState(defaultProductId ?? '')
  const [branchId, setBranchId] = useState(defaultBranchId ?? '')

  function submit(start: string, end: string, pid: string, bid: string) {
    if (!start || !end) return
    const params = new URLSearchParams({ startDate: start, endDate: end })
    if (pid) params.set('productId', pid)
    if (bid) params.set('branchId', bid)
    router.push(`?${params.toString()}`)
  }

  function applyRange(start: string, end: string) {
    setStartDate(start)
    setEndDate(end)
    submit(start, end, productId, branchId)
  }

  return (
    <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
      {/* Predefined range buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {RANGES.map((r) => (
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
        onSubmit={(e) => { e.preventDefault(); submit(startDate, endDate, productId, branchId) }}
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
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            <option value="">-- Semua toko --</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[16rem] flex-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Produk (opsional)
          </label>
          <ProductSelect
            products={products}
            value={productId}
            onChange={setProductId}
            placeholder="-- Semua produk --"
          />
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
