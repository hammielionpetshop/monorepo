'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'

type AuditLogEntry = {
  id: number
  action: string
  tableName: string | null
  recordId: string | null
  oldData: string | null
  newData: string | null
  createdAt: string
  branchName: string | null
  userName: string | null
}

const actionColors: Record<string, string> = {
  MANUAL_STOCK_ADJUSTMENT: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  RETURN_PROCESSED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

function formatDate(dateStr: string) {
  return formatWIB(dateStr, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatJSON(data: string | null) {
  if (!data) return '{}'
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}

export function AuditLogTable() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const actionParam = searchParams.get('action') || ''
  const startDateParam = searchParams.get('startDate') || ''
  const endDateParam = searchParams.get('endDate') || ''

  const [data, setData] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState(actionParam)
  const [startDate, setStartDate] = useState(startDateParam)
  const [endDate, setEndDate] = useState(endDateParam)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

  const fetchData = useCallback(async (filterAction: string, filterStart: string, filterEnd: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterAction) params.set('action', filterAction)
      if (filterStart) params.set('startDate', filterStart)
      if (filterEnd) params.set('endDate', filterEnd)

      const res = await fetch(`/api/bo/audit-log?${params.toString()}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error || 'Gagal mengambil data')
      }

      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch (err: unknown) {
      setData([])
      setTotal(0)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data audit log')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(actionParam, startDateParam, endDateParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyFilters() {
    if (startDate && endDate && startDate > endDate) {
      setError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir')
      return
    }

    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    router.replace(`/audit-log?${params.toString()}`)
    fetchData(action, startDate, endDate)
  }

  function resetFilters() {
    setAction('')
    setStartDate('')
    setEndDate('')
    setError(null)
    router.replace('/audit-log')
    fetchData('', '', '')
  }

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Waktu',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.branchName || '-'}</span>,
    },
    {
      accessorKey: 'userName',
      header: 'Pengguna',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.userName || '-'}</span>,
    },
    {
      accessorKey: 'action',
      header: 'Aksi',
      cell: ({ row }) => (
        <span
          className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
            actionColors[row.original.action] || 'bg-muted text-muted-foreground border-border'
          }`}
        >
          {row.original.action}
        </span>
      ),
    },
    {
      accessorKey: 'tableName',
      header: 'Tabel',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.tableName || '-'}</span>
      ),
    },
    {
      accessorKey: 'recordId',
      header: 'ID Record',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.recordId || '-'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Aksi</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            >
              <option value="">Semua Aksi</option>
              <option value="MANUAL_STOCK_ADJUSTMENT">MANUAL_STOCK_ADJUSTMENT</option>
              <option value="RETURN_PROCESSED">RETURN_PROCESSED</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Terapkan Filter
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <DataTable
        data={data}
        columns={columns}
        emptyMessage="Tidak ada data audit untuk periode yang dipilih"
        isLoading={isLoading}
        loadingMessage="Memuat data..."
        summary={<span>Menampilkan {data.length} dari {total} entri</span>}
        onRowClick={setSelectedEntry}
      />

      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Detail Audit Log</h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Waktu</p>
                  <p className="text-foreground">{formatDate(selectedEntry.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aksi</p>
                  <p className="text-foreground">{selectedEntry.action}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tabel</p>
                  <p className="text-foreground font-mono text-xs">{selectedEntry.tableName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID Record</p>
                  <p className="text-foreground font-mono text-xs">{selectedEntry.recordId || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cabang</p>
                  <p className="text-foreground">{selectedEntry.branchName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pengguna</p>
                  <p className="text-foreground">{selectedEntry.userName || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-2">Data Lama (oldData)</p>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-48 font-mono text-foreground">
                  {formatJSON(selectedEntry.oldData)}
                </pre>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Data Baru (newData)</p>
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-48 font-mono text-foreground">
                  {formatJSON(selectedEntry.newData)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
