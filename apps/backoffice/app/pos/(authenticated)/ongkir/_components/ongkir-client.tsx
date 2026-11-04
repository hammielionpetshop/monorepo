'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import { NewBadge } from '@/components/ui/new-badge'
import { filterOngkirRows, summarizeOngkir, type CashierOngkirRow } from './ongkir-model'

const rupiah = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const inputClass = 'min-h-[38px] rounded-md border border-input bg-background px-3 text-sm'
const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2 text-sm whitespace-nowrap'

const STATUS_LABEL: Record<string, string> = { DIPROSES: 'Diproses', SELESAI: 'Selesai', DIBATALKAN: 'Dibatalkan' }

export default function OngkirClient({
  rows,
  from,
  to,
  error,
}: {
  rows: CashierOngkirRow[]
  from: string
  to: string
  error: string | null
}) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState(from)
  const [dateTo, setDateTo] = useState(to)
  const [courierId, setCourierId] = useState('')
  const [billing, setBilling] = useState<'ALL' | 'CHARGED' | 'FREE'>('ALL')

  const couriers = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of rows) map.set(r.courierId, r.courierName)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])
  const shown = filterOngkirRows(rows, courierId ? Number(courierId) : null, billing)
  const summary = summarizeOngkir(shown)

  function applyDates() {
    const sp = new URLSearchParams({ from: dateFrom, to: dateTo })
    router.push(`/pos/ongkir?${sp}`)
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          Riwayat Ongkir <NewBadge feature="/pos/ongkir" />
        </h1>
        <p className="text-xs text-muted-foreground">
          Semua ongkos kirim dan pengantarnya di cabang ini, termasuk antar-jemput grooming. Kiriman truk Gudang tidak ada di sini
          (tanpa ongkir).
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Dari</label>
          <input type="date" className={inputClass} value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sampai</label>
          <input type="date" className={inputClass} value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button type="button" onClick={applyDates} className="min-h-[38px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Tampilkan
        </button>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Pengantar</label>
          <select className={inputClass} value={courierId} onChange={(e) => setCourierId(e.target.value)}>
            <option value="">Semua</option>
            {couriers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ongkir</label>
          <select className={inputClass} value={billing} onChange={(e) => setBilling(e.target.value as typeof billing)}>
            <option value="ALL">Semua</option>
            <option value="CHARGED">Ditagih</option>
            <option value="FREE">Gratis ongkir</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Jumlah antar</p>
          <p className="text-lg font-bold tabular-nums">{summary.count}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Ongkir ditagih</p>
          <p className="text-lg font-bold tabular-nums">{rupiah(summary.chargedTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Gratis ongkir</p>
          <p className="text-lg font-bold tabular-nums">
            {summary.freeCount} <span className="text-xs font-normal text-muted-foreground">({rupiah(summary.freeTotal)} ditanggung toko)</span>
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Dibatalkan</p>
          <p className="text-lg font-bold tabular-nums">{summary.cancelledCount}</p>
        </div>
      </div>

      {error && <p className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className={th}>Waktu</th>
              <th className={th}>Nota</th>
              <th className={th}>Jenis</th>
              <th className={th}>Pelanggan</th>
              <th className={th}>Pengantar</th>
              <th className={`${th} text-right`}>Ongkir</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada ongkir pada periode ini.</td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className={`border-t border-border/50 ${r.cancelled ? 'opacity-60' : ''}`}>
                <td className={`${td} text-xs text-muted-foreground`}>
                  {formatWIB(r.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className={`${td} font-mono text-xs`}>
                  <Link
                    href={`/pos/history?${new URLSearchParams({ q: r.trxNumber, from, to })}`}
                    className="text-primary hover:underline"
                  >
                    {r.trxNumber}
                  </Link>
                </td>
                <td className={td}>{r.kind === 'GROOMING' ? 'Antar-jemput grooming' : 'Antar barang'}</td>
                <td className={td}>{r.customerName ?? <span className="italic text-muted-foreground">Umum</span>}</td>
                <td className={`${td} font-medium`}>{r.courierName}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r.isFreeShipping ? (
                    <span className="font-semibold text-green-700 dark:text-green-400">GRATIS</span>
                  ) : (
                    rupiah(r.charged)
                  )}
                </td>
                <td className={td}>{STATUS_LABEL[r.status] ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
