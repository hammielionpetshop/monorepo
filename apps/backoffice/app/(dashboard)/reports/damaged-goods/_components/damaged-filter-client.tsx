'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'

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

export default function DamagedFilterClient({
  defaultStartDate,
  defaultEndDate,
  defaultBranchId,
  branches,
}: {
  defaultStartDate?: string
  defaultEndDate?: string
  defaultBranchId?: string
  branches?: { id: number; name: string }[]
}) {
  const router = useRouter()
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const branchRef = useRef<HTMLSelectElement>(null)

  function applyRange(start: string, end: string) {
    if (startRef.current) startRef.current.value = start
    if (endRef.current) endRef.current.value = end
    const branchId = branchRef.current?.value
    const branchParam = branchId ? `&branchId=${branchId}` : ''
    router.push(`?startDate=${start}&endDate=${end}${branchParam}`)
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-8 shadow-xs">
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

      <form method="GET" className="flex flex-wrap gap-6 items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startDate" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Tanggal Mulai
          </label>
          <input
            ref={startRef}
            id="startDate"
            type="date"
            name="startDate"
            defaultValue={defaultStartDate ?? ''}
            required
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="endDate" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Tanggal Selesai
          </label>
          <input
            ref={endRef}
            id="endDate"
            type="date"
            name="endDate"
            defaultValue={defaultEndDate ?? ''}
            required
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
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
