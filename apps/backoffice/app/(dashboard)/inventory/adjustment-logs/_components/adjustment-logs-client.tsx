'use client'

import { useState, useRef, useEffect } from 'react'
import { z } from 'zod'
import type { AdjustmentLogEntry } from '../page'

const adjustmentLogEntrySchema = z.object({
  id: z.number(),
  productName: z.string(),
  productSku: z.string().nullable(),
  branchName: z.string(),
  adjustedByName: z.string(),
  previousQty: z.string(),
  newQty: z.string(),
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
}

function formatDateTime(value: Date | string): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdjustmentLogsClient({ initialData }: Props) {
  const [data, setData] = useState<AdjustmentLogEntry[]>(() => [...initialData])
  const [productFilter, setProductFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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
    setData([...initialData])
    setErrorMsg(null)
  }

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      <div className="flex flex-wrap gap-3 items-end">
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

      <p className="text-xs text-muted-foreground">
        Menampilkan {filtered.length} entri
        {data.length === 100 ? ' (maks 100 terbaru)' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Tidak ada data penyesuaian stok.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Produk</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cabang</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sebelum</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sesudah</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">Selisih</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Alasan</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Petugas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{row.productName}</div>
                    {row.productSku && (
                      <div className="text-xs text-muted-foreground">{row.productSku}</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{row.branchName}</td>
                  <td className="py-2 px-3 text-right font-mono">{row.previousQty}</td>
                  <td className="py-2 px-3 text-right font-mono">{row.newQty}</td>
                  <td
                    className={`py-2 px-3 text-right font-mono font-semibold ${
                      row.deltaQty.startsWith('-')
                        ? 'text-destructive'
                        : row.deltaQty === '0.00' || row.deltaQty === '0'
                          ? 'text-muted-foreground'
                          : 'text-green-600'
                    }`}
                  >
                    {row.deltaFormatted}
                  </td>
                  <td className="py-2 px-3 max-w-xs">
                    <span className="line-clamp-2 text-sm">{row.reason || '-'}</span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{row.adjustedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
