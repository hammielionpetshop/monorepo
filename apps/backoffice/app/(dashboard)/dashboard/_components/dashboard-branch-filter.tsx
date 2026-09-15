'use client'

import { useRouter } from 'next/navigation'

export interface BranchOption {
  id: number
  name: string
}

export function DashboardBranchFilter({
  branches,
  defaultBranchId,
}: {
  branches: BranchOption[]
  defaultBranchId?: string
}) {
  const router = useRouter()

  return (
    <select
      id="dashboard-branch-filter"
      aria-label="Filter cabang"
      value={defaultBranchId ?? ''}
      onChange={(e) => {
        const value = e.target.value
        router.push(value ? `?branchId=${value}` : '?')
      }}
      className="bg-background border border-input rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
    >
      <option value="">Semua Cabang</option>
      {branches.map((b) => (
        <option key={b.id} value={String(b.id)}>{b.name}</option>
      ))}
    </select>
  )
}
