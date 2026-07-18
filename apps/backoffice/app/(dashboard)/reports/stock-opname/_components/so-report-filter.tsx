'use client'

import { useRouter } from 'next/navigation'
import { useRef } from 'react'

import { STATUS_LABELS } from './format'

const RANGES = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
]

function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toLocalISO(d)
}

export default function SOReportFilter({
  defaultStartDate,
  defaultEndDate,
  defaultBranchId,
  defaultStatus,
  branches,
}: {
  defaultStartDate: string
  defaultEndDate: string
  defaultBranchId?: string
  defaultStatus?: string
  branches?: { id: number; name: string }[]
}) {
  const router = useRouter()
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const branchRef = useRef<HTMLSelectElement>(null)
  const statusRef = useRef<HTMLSelectElement>(null)

  function applyRange(days: number) {
    const start = daysAgo(days)
    const end = toLocalISO(new Date())
    if (startRef.current) startRef.current.value = start
    if (endRef.current) endRef.current.value = end

    const query = new URLSearchParams({ startDate: start, endDate: end })
    const branchId = branchRef.current?.value
    if (branchId) query.set('branchId', branchId)
    const status = statusRef.current?.value
    if (status) query.set('status', status)
    router.push(`?${query.toString()}`)
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 mb-8 shadow-xs print:hidden">
      <div className="flex flex-wrap gap-2 mb-5">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => applyRange(r.days)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            {r.label} Terakhir
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
            defaultValue={defaultStartDate}
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
            defaultValue={defaultEndDate}
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Status
          </label>
          <select
            ref={statusRef}
            id="status"
            name="status"
            defaultValue={defaultStatus ?? ''}
            className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          >
            <option value="">Semua Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
