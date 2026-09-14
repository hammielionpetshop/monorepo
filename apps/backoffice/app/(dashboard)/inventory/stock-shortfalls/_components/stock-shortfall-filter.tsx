'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'

export default function StockShortfallFilter({
  defaultBranchId,
  defaultSearch,
  branches,
}: {
  defaultBranchId?: string
  defaultSearch?: string
  branches?: { id: number; name: string }[]
}) {
  const router = useRouter()
  const branchRef = useRef<HTMLSelectElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  function buildQuery() {
    const query = new URLSearchParams()
    const branchId = branchRef.current?.value
    if (branchId) query.set('branchId', branchId)
    const q = searchRef.current?.value.trim()
    if (q) query.set('q', q)
    return query
  }

  // Dicegat supaya soft navigation (client-side), bukan reload penuh — pola sama seperti
  // filter Resolusi Selisih SO.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    router.push(`?${buildQuery().toString()}`)
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-6 shadow-xs">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-6 items-end">
        {branches && branches.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="branchId" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Cabang
            </label>
            <select
              ref={branchRef}
              id="branchId"
              name="branchId"
              defaultValue={defaultBranchId ?? ''}
              className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            >
              <option value="">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Cari Produk
          </label>
          <input
            ref={searchRef}
            id="q"
            type="text"
            name="q"
            defaultValue={defaultSearch ?? ''}
            placeholder="Nama produk atau SKU"
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-w-[220px]"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:opacity-90 transition-all shadow-sm"
        >
          Tampilkan
        </button>
      </form>
    </div>
  )
}
