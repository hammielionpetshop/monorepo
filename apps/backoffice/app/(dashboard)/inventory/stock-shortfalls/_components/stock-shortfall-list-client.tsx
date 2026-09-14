'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { StockShortfallListItem } from '@/lib/services/stock-shortfall-report'

interface Props {
  initialRows: StockShortfallListItem[]
}

const SOURCE_LABELS: Record<string, string> = {
  SALE: 'Penjualan',
  TRX_EDIT: 'Koreksi Nota',
}

function formatRupiah(value: number | null | undefined): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

export default function StockShortfallListClient({ initialRows }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<StockShortfallListItem[]>(initialRows)
  const [modalItem, setModalItem] = useState<StockShortfallListItem | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function openModal(item: StockShortfallListItem) {
    setModalItem(item)
    setReason('')
    setModalError(null)
  }

  function closeModal() {
    setModalItem(null)
  }

  async function submitWriteOff() {
    if (!modalItem) return
    if (!reason.trim()) {
      setModalError('Alasan wajib diisi')
      return
    }

    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/bo/inventory/stock-shortfalls/${modalItem.id}/write-off`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModalError(data.error ?? `Gagal menutup shortfall (${res.status})`)
        return
      }

      setRows((prev) => prev.filter((r) => r.id !== modalItem.id))
      setSuccessMsg(`Shortfall ${modalItem.productName} ditutup (write-off).`)
      closeModal()
      router.refresh()
    } catch {
      setModalError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<StockShortfallListItem, unknown>[] = [
    {
      accessorKey: 'productName',
      header: 'Produk',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.productName}</p>
          {row.original.sku && <p className="text-xs text-muted-foreground">SKU: {row.original.sku}</p>}
        </div>
      ),
    },
    { accessorKey: 'branchName', header: 'Cabang' },
    {
      id: 'qty',
      header: 'Qty Kurang / Sisa',
      cell: ({ row }) => (
        <span className="font-medium text-destructive">
          {row.original.qtyRemaining} / {row.original.qtyShort} {row.original.uomCode}
        </span>
      ),
    },
    {
      accessorKey: 'costPricePerUnit',
      header: 'Estimasi Nilai',
      cell: ({ row }) => formatRupiah(row.original.qtyRemaining * row.original.costPricePerUnit),
    },
    {
      id: 'sumber',
      header: 'Sumber',
      cell: ({ row }) => (
        <div>
          <p className="text-xs">{SOURCE_LABELS[row.original.sourceType] ?? row.original.sourceType}</p>
          {row.original.trxNumber && <p className="text-xs text-muted-foreground font-mono">{row.original.trxNumber}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Terjadi',
      cell: ({ row }) => (
        <div>
          <p className="text-xs text-muted-foreground">{formatWIB(row.original.createdAt)}</p>
          {row.original.isAging && (
            <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-destructive/10 text-destructive">
              {row.original.ageDays} hari — tinjau
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'aksi',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => openModal(row.original)}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Tutup (Write-off)
        </button>
      ),
    },
  ]

  return (
    <div>
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
          {successMsg}
        </div>
      )}

      <DataTable
        data={rows}
        columns={columns}
        emptyMessage="Tidak ada utang stok yang masih terbuka."
        pageSize={15}
        enableSorting
      />

      {modalItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" role="presentation" onClick={closeModal} />
          <div className="fixed inset-x-4 top-8 bottom-8 z-50 mx-auto max-w-xl overflow-y-auto rounded-2xl bg-background shadow-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">Tutup Shortfall (Write-off)</h2>
              <button type="button" onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {modalItem.productName} &middot; {modalItem.branchName} &middot; sisa{' '}
              <span className="text-destructive font-medium">
                {modalItem.qtyRemaining} {modalItem.uomCode}
              </span>
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Gunakan ini HANYA kalau barangnya terbukti hilang/rusak (bukan sekadar telat input PO)
              — angka stok TIDAK akan berubah, ini cuma menghentikan pengharapan pelunasan &amp;
              menghilangkannya dari daftar ini.
            </p>

            {modalError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm mb-3">
                {modalError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Alasan</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={255}
                placeholder="Jelaskan kenapa shortfall ini tidak akan pernah lunas dari PO..."
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={submitWriteOff}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Menyimpan...' : 'Tutup Shortfall'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
