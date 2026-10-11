'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageX, Tag } from 'lucide-react'
import { ReturnedGoodsForm } from './returned-goods-form'
import { PriceRevisionForm } from './price-revision-form'
import { InternalReturnList } from './internal-return-list'
import type { InternalReturnStatus, InternalReturnView } from './types'

const TABS: { key: InternalReturnStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'PENDING', label: 'Menunggu' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'REJECTED', label: 'Ditolak' },
  { key: 'CANCELLED', label: 'Dibatalkan' },
  { key: 'WITHDRAWN', label: 'Ditarik' },
]

/**
 * Isi layar Retur Internal (POS & Back Office): pilihan jenis di atas (keputusan owner #6 —
 * "Barang Dikembalikan" dan "Revisi Harga Beli"), form pengajuan jenis yang dipilih, lalu riwayat
 * dokumen kedua jenis.
 */
export function InternalReturnsPanel({
  apiBase,
  printBase,
  userId,
  canCancel,
  historyTitle,
}: {
  /** `/api/pos/internal-returns` atau `/api/bo/internal-returns`. */
  apiBase: string
  /** Awalan halaman cetak, mis. `/pos/produk/retur-internal` → `${printBase}/${id}/cetak`. */
  printBase: string
  userId: number
  /** OWNER/GM di Back Office — boleh membatalkan retur yang sudah disetujui. */
  canCancel: boolean
  historyTitle: string
}) {
  const [formKind, setFormKind] = useState<'GOODS' | 'PRICE' | null>(null)
  const [rows, setRows] = useState<InternalReturnView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState<InternalReturnStatus | 'ALL'>('ALL')

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setLoadError(data.error ?? 'Gagal mengambil riwayat retur internal')
      setLoadError('')
      setRows(Array.isArray(data.data) ? data.data : [])
    } catch {
      setLoadError('Gagal mengambil riwayat retur internal')
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => rows.filter(r => tab === 'ALL' || r.status === tab), [rows, tab])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => { setFormKind('GOODS'); setSuccess('') }}
          aria-pressed={formKind === 'GOODS'}
          className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
            formKind === 'GOODS' ? 'border-primary bg-primary/5' : 'border-primary/40 bg-card hover:border-primary hover:bg-primary/5'
          }`}
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PackageX className="h-7 w-7" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-bold text-foreground">Barang Dikembalikan</span>
            <span className="block text-sm text-muted-foreground">
              Barang kiriman tercatat tapi tidak datang / salah kirim. Stok kembali ke cabang pengirim, hutang internal
              dipotong.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setFormKind('PRICE'); setSuccess('') }}
          aria-pressed={formKind === 'PRICE'}
          className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
            formKind === 'PRICE' ? 'border-primary bg-primary/5' : 'border-primary/40 bg-card hover:border-primary hover:bg-primary/5'
          }`}
        >
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Tag className="h-7 w-7" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-bold text-foreground">Revisi Harga Beli</span>
            <span className="block text-sm text-muted-foreground">
              Harga di nota kiriman salah. Stok tidak bergeser, hanya harga yang dibetulkan — modal barang dan hutang
              internal ikut menyesuaikan.
            </span>
          </span>
        </button>
      </div>

      {success && (
        <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      )}

      {formKind && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              {formKind === 'PRICE' ? 'Ajukan Revisi Harga Beli' : 'Ajukan Barang Dikembalikan'}
            </h2>
            <button type="button" onClick={() => setFormKind(null)} className="text-sm text-muted-foreground hover:text-foreground">
              Tutup form
            </button>
          </div>
          {formKind === 'PRICE' ? (
            <PriceRevisionForm
              apiBase={apiBase}
              onSubmitted={(returnNumber) => {
                setFormKind(null)
                setSuccess(`Revisi harga beli ${returnNumber} diajukan — menunggu persetujuan Owner/GM di Permintaan Persetujuan.`)
                load()
              }}
            />
          ) : (
            <ReturnedGoodsForm
              apiBase={apiBase}
              onSubmitted={(returnNumber) => {
                setFormKind(null)
                setSuccess(`Retur internal ${returnNumber} diajukan — menunggu persetujuan Owner/GM di Permintaan Persetujuan.`)
                load()
              }}
            />
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">{historyTitle}</h2>
          <div className="flex flex-wrap gap-1">
            {TABS.map(t => {
              const count = t.key === 'ALL' ? rows.length : rows.filter(r => r.status === t.key).length
              if (t.key !== 'ALL' && t.key !== 'PENDING' && count === 0) return null
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label} {count}
                </button>
              )
            })}
          </div>
        </div>
        {loadError && <p className="py-2 text-sm text-destructive" role="alert">{loadError}</p>}
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Memuat…</p>
        ) : (
          <InternalReturnList
            rows={filtered}
            printHref={(id) => `${printBase}/${id}/cetak`}
            emptyText={tab === 'ALL' ? 'Belum ada pengajuan retur internal' : 'Tidak ada retur internal untuk filter ini.'}
            actions={{
              apiBase,
              userId,
              canCancel,
              onChanged: (message) => {
                setSuccess(message)
                load()
              },
            }}
          />
        )}
      </div>
    </div>
  )
}
