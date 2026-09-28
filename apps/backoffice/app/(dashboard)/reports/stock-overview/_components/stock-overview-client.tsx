'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil } from 'lucide-react'
import {
  clampPageIndex,
  getPaginationSummary,
  readPersistedPageIndex,
  writePersistedPageIndex,
} from '@/components/ui/data-table-pagination'
import type { StockOverviewItem, StockOverviewDetail } from './types'
import StockMutationPanel from './stock-mutation-panel'

const PAGE_SIZE = 20

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value))
  } catch {
    return 'Rp 0'
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface EditState {
  batchId: number
  costPrice: string
  reason: string
}

export default function StockOverviewClient({
  items,
  canCorrectBatch = false,
}: {
  items: StockOverviewItem[]
  canCorrectBatch?: boolean
}) {
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)
  const [detailCache, setDetailCache] = useState<Record<number, StockOverviewDetail | 'loading' | 'error'>>({})
  const [expandedBranchId, setExpandedBranchId] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<'stock' | 'mutation'>('stock')
  const [pageIndex, setPageIndex] = useState(() => readPersistedPageIndex('stock-overview'))
  const [editState, setEditState] = useState<EditState | null>(null)
  const [savingBatchId, setSavingBatchId] = useState<number | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    setPageIndex((current) => clampPageIndex(current, PAGE_SIZE, items.length))
  }, [items.length])

  useEffect(() => {
    writePersistedPageIndex('stock-overview', pageIndex)
  }, [pageIndex])

  const pageItems = items.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE)
  const canPreviousPage = pageIndex > 0
  const canNextPage = (pageIndex + 1) * PAGE_SIZE < items.length

  async function toggleProduct(productId: number) {
    if (expandedProductId === productId) {
      setExpandedProductId(null)
      return
    }
    setExpandedProductId(productId)
    setExpandedBranchId(null)
    if (detailCache[productId]) return

    setDetailCache((prev) => ({ ...prev, [productId]: 'loading' }))
    try {
      const res = await fetch(`/api/bo/reports/stock-overview/${productId}`)
      if (!res.ok) throw new Error('Gagal memuat detail')
      const data: StockOverviewDetail = await res.json()
      setDetailCache((prev) => ({ ...prev, [productId]: data }))
    } catch {
      setDetailCache((prev) => ({ ...prev, [productId]: 'error' }))
    }
  }

  async function refetchDetail(productId: number) {
    try {
      const res = await fetch(`/api/bo/reports/stock-overview/${productId}`)
      if (!res.ok) throw new Error('Gagal memuat detail')
      const data: StockOverviewDetail = await res.json()
      setDetailCache((prev) => ({ ...prev, [productId]: data }))
    } catch {
      setDetailCache((prev) => ({ ...prev, [productId]: 'error' }))
    }
  }

  function startEdit(batch: StockOverviewDetail['branches'][number]['batches'][number]) {
    setEditError(null)
    setEditState({ batchId: batch.id, costPrice: batch.costPrice, reason: '' })
  }

  function cancelEdit() {
    setEditState(null)
    setEditError(null)
  }

  async function saveEdit(productId: number) {
    if (!editState) return
    setEditError(null)

    const costPrice = Number(editState.costPrice)
    if (!Number.isInteger(costPrice) || costPrice < 0) {
      setEditError('Modal/unit harus berupa angka bulat ≥ 0')
      return
    }
    if (editState.reason.trim().length === 0) {
      setEditError('Alasan koreksi wajib diisi')
      return
    }

    setSavingBatchId(editState.batchId)
    try {
      const res = await fetch(`/api/bo/reports/stock-overview/batch/${editState.batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ costPrice, reason: editState.reason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan koreksi batch')

      setEditState(null)
      await refetchDetail(productId)
      router.refresh()
    } catch (e: unknown) {
      setEditError((e as Error).message)
    } finally {
      setSavingBatchId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground text-sm">
        Tidak ada produk dengan stok tersedia saat ini
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-muted-foreground border-b border-border">
              <th className="w-10 px-4 py-4"></th>
              <th className="text-left px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Nama Produk</th>
              <th className="text-left px-4 py-4 font-bold uppercase tracking-widest text-[10px]">SKU</th>
              <th className="text-left px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Kategori</th>
              <th className="text-right px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Total Stok</th>
              <th className="text-right px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Nilai Stok (FIFO)</th>
              <th className="text-right px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Utang Stok</th>
              <th className="text-center px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
              <th className="text-center px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Batch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageItems.map((item) => {
              const isExpanded = expandedProductId === item.productId
              const detail = detailCache[item.productId]
              const hasShortfall = Number(item.shortfallQty) > 0

              return (
                <>
                  <tr
                    key={item.productId}
                    onClick={() => toggleProduct(item.productId)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4 text-muted-foreground">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-4 py-4 font-semibold text-card-foreground">{item.productName}</td>
                    <td className="px-4 py-4 text-muted-foreground font-mono text-xs">{item.sku ?? '-'}</td>
                    <td className="px-4 py-4 text-muted-foreground">{item.categoryName ?? '-'}</td>
                    <td className="px-4 py-4 text-right font-medium text-card-foreground">
                      {item.stockDisplay}
                      <span className="block text-[11px] text-muted-foreground font-normal">({item.totalQty})</span>
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(item.totalValue)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {hasShortfall ? (
                        <span className="font-bold text-destructive">{formatRupiah(item.shortfallValue)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-card-foreground">{item.branchCount}</td>
                    <td className="px-4 py-4 text-center text-card-foreground">{item.batchCount}</td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${item.productId}-detail`}>
                      <td colSpan={9} className="bg-muted/10 px-4 py-4">
                        <div className="mb-3 inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
                          {([
                            ['stock', 'Stok per Cabang'],
                            ['mutation', 'Ringkasan Mutasi'],
                          ] as const).map(([tab, label]) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setDetailTab(tab)}
                              className={`rounded px-3 py-1 font-medium transition-colors ${
                                detailTab === tab
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {detailTab === 'mutation' && <StockMutationPanel productId={item.productId} productName={item.productName} />}
                        {detailTab === 'stock' && detail === 'loading' && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Memuat detail batch...
                          </div>
                        )}
                        {detailTab === 'stock' && detail === 'error' && (
                          <div className="text-destructive text-sm py-4">Gagal memuat detail batch. Coba lagi.</div>
                        )}
                        {detailTab === 'stock' && detail && detail !== 'loading' && detail !== 'error' && (
                          <div className="flex flex-col gap-2">
                            {detail.branches.length === 0 && (
                              <div className="text-muted-foreground text-sm py-2">Tidak ada baris cabang untuk produk ini.</div>
                            )}
                            {detail.branches.map((branch) => {
                              const branchExpanded = expandedBranchId === branch.branchId
                              return (
                                <div key={branch.branchId} className="rounded-md border border-border bg-card">
                                  <div
                                    onClick={() => setExpandedBranchId(branchExpanded ? null : branch.branchId)}
                                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      {branchExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      <span className="font-semibold text-card-foreground">{branch.branchName}</span>
                                      <span className="text-xs text-muted-foreground">{branch.batchCount} batch</span>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                      <span className="text-card-foreground">{branch.totalQty} unit</span>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(branch.totalValue)}</span>
                                      {Number(branch.shortfallQty) > 0 && (
                                        <span className="font-bold text-destructive">Utang: {formatRupiah(branch.shortfallValue)}</span>
                                      )}
                                    </div>
                                  </div>
                                  {branchExpanded && (
                                    <div className="border-t border-border overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-muted/20 text-muted-foreground">
                                            <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">Kode Batch</th>
                                            <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">PO</th>
                                            <th className="text-right px-4 py-2 font-bold uppercase tracking-widest">Diterima</th>
                                            <th className="text-right px-4 py-2 font-bold uppercase tracking-widest">Sisa</th>
                                            <th className="text-right px-4 py-2 font-bold uppercase tracking-widest">Modal/Unit</th>
                                            <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">Tgl Masuk</th>
                                            <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">Kedaluwarsa</th>
                                            {canCorrectBatch && (
                                              <th className="text-right px-4 py-2 font-bold uppercase tracking-widest">Aksi</th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                          {branch.batches.map((batch) => {
                                            const isEditing = editState?.batchId === batch.id
                                            const isSaving = savingBatchId === batch.id
                                            return (
                                              <>
                                                <tr key={batch.id}>
                                                  <td className="px-4 py-2 font-mono text-card-foreground">{batch.displayCode}</td>
                                                  <td className="px-4 py-2 text-muted-foreground">{batch.poNumber ?? '-'}</td>
                                                  <td className="px-4 py-2 text-right text-card-foreground">{batch.qtyReceived}</td>
                                                  <td className="px-4 py-2 text-right text-card-foreground">{batch.qtyRemaining}</td>
                                                  <td className="px-4 py-2 text-right text-card-foreground">
                                                    {isEditing ? (
                                                      <input
                                                        type="number"
                                                        min={0}
                                                        step={1}
                                                        value={editState.costPrice}
                                                        onChange={(e) => setEditState({ ...editState, costPrice: e.target.value })}
                                                        className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-xs"
                                                        autoFocus
                                                      />
                                                    ) : (
                                                      formatRupiah(batch.costPrice)
                                                    )}
                                                  </td>
                                                  <td className="px-4 py-2 text-muted-foreground">{formatDate(batch.receivedAt)}</td>
                                                  <td className="px-4 py-2 text-muted-foreground">{batch.expiryDate ? formatDate(batch.expiryDate) : '-'}</td>
                                                  {canCorrectBatch && (
                                                    <td className="px-4 py-2 text-right whitespace-nowrap">
                                                      {isEditing ? (
                                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Mengedit</span>
                                                      ) : (
                                                        <button
                                                          type="button"
                                                          onClick={() => startEdit(batch)}
                                                          className="p-1 rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                                          title="Koreksi modal batch"
                                                        >
                                                          <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                      )}
                                                    </td>
                                                  )}
                                                </tr>
                                                {isEditing && (
                                                  <tr key={`${batch.id}-edit`}>
                                                    <td colSpan={canCorrectBatch ? 8 : 7} className="bg-muted/10 px-4 py-2">
                                                      <div className="flex items-center gap-2">
                                                        <input
                                                          type="text"
                                                          placeholder="Alasan koreksi (wajib)"
                                                          value={editState.reason}
                                                          onChange={(e) => setEditState({ ...editState, reason: e.target.value })}
                                                          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                                                        />
                                                        <button
                                                          type="button"
                                                          disabled={isSaving}
                                                          onClick={() => saveEdit(item.productId)}
                                                          className="text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                                                        >
                                                          {isSaving ? 'Menyimpan...' : 'Simpan'}
                                                        </button>
                                                        <button
                                                          type="button"
                                                          disabled={isSaving}
                                                          onClick={cancelEdit}
                                                          className="text-xs px-2.5 py-1 rounded-md border border-border disabled:opacity-50"
                                                        >
                                                          Batal
                                                        </button>
                                                      </div>
                                                      {editError && <p className="mt-1.5 text-xs text-destructive">{editError}</p>}
                                                    </td>
                                                  </tr>
                                                )}
                                              </>
                                            )
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
        <div className="text-muted-foreground">{getPaginationSummary(pageIndex, PAGE_SIZE, items.length)}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageIndex((p) => p - 1)}
            disabled={!canPreviousPage}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPageIndex((p) => p + 1)}
            disabled={!canNextPage}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
