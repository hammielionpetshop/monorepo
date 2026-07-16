'use client'

import React, { useState, useRef, useEffect } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { AdjustmentLogEntry, BranchOption } from '../page'

const adjustmentLogEntrySchema = z.object({
  id: z.number(),
  productName: z.string(),
  productSku: z.string().nullable(),
  branchName: z.string(),
  adjustedByName: z.string(),
  previousQty: z.coerce.number(),
  newQty: z.coerce.number(),
  deltaQty: z.string(),
  deltaFormatted: z.string(),
  reason: z.string(),
  createdAt: z.string(),
})

const apiResponseSchema = z.object({
  data: z.array(adjustmentLogEntrySchema),
  total: z.number(),
})

interface Props {
  initialData: AdjustmentLogEntry[]
  branches: BranchOption[]
}

function formatDateTime(value: Date | string): string {
  return formatWIB(value, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdjustmentLogsClient({ initialData, branches }: Props) {
  const [data, setData] = useState<AdjustmentLogEntry[]>(() => [...initialData])
  const [productFilter, setProductFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const filtered = productFilter.trim()
    ? data.filter(
        (row) =>
          row.productName.toLowerCase().includes(productFilter.toLowerCase()) ||
          (row.productSku ?? '').toLowerCase().includes(productFilter.toLowerCase())
      )
    : data

  async function applyDateFilter() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setErrorMsg(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (branchFilter) params.set('branchId', branchFilter)

      const res = await fetch(`/api/bo/inventory/adjustment-logs?${params.toString()}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        let msg: string
        try {
          const json = JSON.parse(text)
          msg = json.error ?? `Gagal mengambil data (${res.status})`
        } catch {
          msg = `Gagal mengambil data (${res.status})`
        }
        setErrorMsg(msg)
        return
      }

      const json = await res.json()
      const parsed = apiResponseSchema.safeParse(json)
      if (!parsed.success) {
        setErrorMsg('Data tidak sesuai format yang diharapkan')
        return
      }
      setData(parsed.data.data)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setLoading(false)
    }
  }

  function resetFilter() {
    abortRef.current?.abort()
    setStartDate('')
    setEndDate('')
    setProductFilter('')
    setBranchFilter('')
    setData([...initialData])
    setErrorMsg(null)
  }

  const columns: ColumnDef<AdjustmentLogEntry>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: 'productName',
      header: 'Produk',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.productName}</div>
          {row.original.productSku && (
            <div className="text-xs text-muted-foreground">{row.original.productSku}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.branchName}</span>,
    },
    {
      accessorKey: 'previousQty',
      header: () => <div className="text-right">Sebelum</div>,
      cell: ({ row }) => <div className="text-right font-mono">{row.original.previousQty}</div>,
    },
    {
      accessorKey: 'newQty',
      header: () => <div className="text-right">Sesudah</div>,
      cell: ({ row }) => <div className="text-right font-mono">{row.original.newQty}</div>,
    },
    {
      accessorKey: 'deltaQty',
      header: () => <div className="text-right">Selisih</div>,
      cell: ({ row }) => (
        <div
          className={`text-right font-mono font-semibold ${
            row.original.deltaQty.startsWith('-')
              ? 'text-destructive'
              : row.original.deltaQty === '0.00' || row.original.deltaQty === '0'
                ? 'text-muted-foreground'
                : 'text-green-600'
          }`}
        >
          {row.original.deltaFormatted}
        </div>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Alasan',
      cell: ({ row }) => (
        <span className="line-clamp-2 text-sm">{row.original.reason || '-'}</span>
      ),
    },
    {
      accessorKey: 'adjustedByName',
      header: 'Petugas',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.adjustedByName}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        {branches.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Cabang</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
            >
              <option value="">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Cari Produk</label>
          <input
            type="text"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            placeholder="Nama atau SKU produk..."
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background w-52"
          />
        </div>
        <button
          onClick={applyDateFilter}
          disabled={loading}
          className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Memuat...' : 'Terapkan Filter'}
        </button>
        <button
          onClick={resetFilter}
          className="px-3 py-1.5 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
        >
          Reset
        </button>
      </div>

      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada data penyesuaian stok."
        isLoading={loading}
        loadingMessage="Memuat data..."
        summary={
          <span>
            Menampilkan {filtered.length} entri
            {data.length === 100 ? ' (maks 100 terbaru)' : ''}
          </span>
        }
      />
    </div>
  )
}
