'use client'

import { useState, useCallback } from 'react'
import { formatWIB } from '@petshop/shared'
import type { StockLogEntry } from '@/lib/services/stock-ledger'
import type { BranchOption } from '../page'

const MOVEMENT_TYPES = [
  { value: '', label: 'Semua Jenis' },
  { value: 'SALE_OUT', label: 'Penjualan' },
  { value: 'SALE_VOID', label: 'Void Penjualan' },
  { value: 'PO_IN', label: 'Penerimaan PO' },
  { value: 'ADJUSTMENT', label: 'Penyesuaian' },
  { value: 'OPNAME', label: 'Stock Opname' },
  { value: 'BREAK_OUT', label: 'Pecah Satuan (Keluar)' },
  { value: 'BREAK_IN', label: 'Pecah Satuan (Masuk)' },
  { value: 'RETURN_IN', label: 'Retur' },
  { value: 'DAMAGED_OUT', label: 'Barang Rusak' },
  { value: 'TRANSFER_OUT', label: 'Transfer Keluar (Cabang)' },
  { value: 'TRANSFER_IN', label: 'Transfer Masuk (Cabang)' },
] as const

const BADGE_STYLE: Record<string, string> = {
  SALE_OUT:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SALE_VOID:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PO_IN:      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ADJUSTMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  OPNAME:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  BREAK_OUT:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  BREAK_IN:   'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400',
  RETURN_IN:  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  DAMAGED_OUT: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  TRANSFER_OUT: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  TRANSFER_IN:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
}

const MOVEMENT_LABEL: Record<string, string> = {
  SALE_OUT:   'Penjualan',
  SALE_VOID:  'Void Penjualan',
  PO_IN:      'Penerimaan PO',
  ADJUSTMENT: 'Penyesuaian',
  OPNAME:     'Stock Opname',
  BREAK_OUT:  'Pecah (Keluar)',
  BREAK_IN:   'Pecah (Masuk)',
  RETURN_IN:  'Retur',
  DAMAGED_OUT: 'Barang Rusak',
  TRANSFER_OUT: 'Transfer Keluar',
  TRANSFER_IN:  'Transfer Masuk',
}

function formatDateTime(iso: string): string {
  return formatWIB(iso, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatRupiah(value: number | null): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(value)
}

interface Props {
  initialData: StockLogEntry[]
  initialError: string | null
  branches: BranchOption[]
  defaultFrom: string
  defaultTo: string
  isGlobal: boolean
}

export default function StockLogsClient({
  initialData,
  initialError,
  branches,
  defaultFrom,
  defaultTo,
  isGlobal,
}: Props) {
  const [data, setData] = useState<StockLogEntry[]>(initialData)
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(initialData.length)

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [branchId, setBranchId] = useState('')
  const [movementType, setMovementType] = useState('')
  const [q, setQ] = useState('')

  const fetchData = useCallback(async (params: {
    from: string, to: string, branchId: string, movementType: string, q: string
  }) => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (params.from) sp.set('startDate', params.from)
      if (params.to) sp.set('endDate', params.to)
      if (params.branchId) sp.set('branchId', params.branchId)
      if (params.movementType) sp.set('movementType', params.movementType)
      if (params.q.trim()) sp.set('q', params.q.trim())

      const res = await fetch(`/api/bo/inventory/stock-logs?${sp}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal mengambil data')
        return
      }
      setData(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setLoading(false)
    }
  }, [])

  function handleApply() {
    fetchData({ from, to, branchId, movementType, q })
  }

  function handleReset() {
    setFrom(defaultFrom)
    setTo(defaultTo)
    setBranchId('')
    setMovementType('')
    setQ('')
    fetchData({ from: defaultFrom, to: defaultTo, branchId: '', movementType: '', q: '' })
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tanggal dari */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Tanggal sampai */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={to}
              min={from}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Jenis Mutasi */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Jenis Mutasi</label>
            <select
              value={movementType}
              onChange={e => setMovementType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {MOVEMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Cabang — hanya peran global (OWNER/GM) */}
          {isGlobal && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cabang</label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Semua Cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Cari Produk */}
        <div className="flex gap-2">
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleApply()}
            placeholder="Cari nama atau SKU produk..."
            className="flex-1 px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Memuat...' : 'Terapkan'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {/* Summary */}
      {!error && (
        <p className="text-sm text-muted-foreground">
          Menampilkan <span className="font-semibold text-foreground">{total}</span> entri
          {total >= 300 && (
            <span className="ml-1 text-amber-600">(maks 300 — persempit filter tanggal untuk hasil lebih spesifik)</span>
          )}
        </p>
      )}

      {/* Tabel */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Tanggal & Jam</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Jenis</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Produk</th>
                {isGlobal && <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cabang</th>}
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Satuan</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-right">Harga Satuan</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Referensi</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Petugas</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isGlobal ? 10 : 9} className="px-4 py-10 text-center text-muted-foreground">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={isGlobal ? 10 : 9} className="px-4 py-10 text-center text-muted-foreground">
                    Tidak ada data pada rentang tanggal ini.
                  </td>
                </tr>
              )}
              {!loading && data.map(row => {
                const isPositive = row.qtyChange > 0
                const isNegative = row.qtyChange < 0
                return (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_STYLE[row.movementType] ?? 'bg-muted text-muted-foreground'}`}>
                        {MOVEMENT_LABEL[row.movementType] ?? row.movementType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground leading-tight">{row.productName}</p>
                      {row.productSku && (
                        <p className="text-xs text-muted-foreground mt-0.5">{row.productSku}</p>
                      )}
                    </td>
                    {isGlobal && (
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{row.branchName}</td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{row.uomCode}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right tabular-nums ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-foreground'}`}>
                      {isPositive ? `+${row.qtyChange}` : row.qtyChange}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums text-foreground">
                      {formatRupiah(row.unitPrice)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-primary">{row.referenceNumber}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{row.actorName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {row.notes ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
