'use client'

import { useState } from 'react'
import { ProductSelect } from '@/components/ui/product-select'
import type { ProductOption, UomOption, StockUomData, UomGroup } from './types'

interface Props {
  products: ProductOption[]
  uoms: UomOption[]
}

function buildGroups(data: StockUomData, uoms: UomOption[]): UomGroup[] {
  const uomById = new Map(uoms.map((u) => [u.id, u]))
  const map = new Map<string, UomGroup>()

  for (const s of data.stocks) {
    const key = `${s.branchId}:${s.uomId}`
    map.set(key, {
      branchId: s.branchId,
      branchName: s.branchName,
      uomId: s.uomId,
      uomCode: s.uomCode,
      uomName: s.uomName,
      stock: s,
      batches: [],
      priceCount: 0,
      costCount: 0,
    })
  }

  for (const b of data.batches) {
    const key = `${b.branchId}:${b.uomId}`
    const existing = map.get(key)
    if (existing) {
      existing.batches.push(b)
    } else {
      const uom = uomById.get(b.uomId)
      map.set(key, {
        branchId: b.branchId,
        branchName: b.branchName,
        uomId: b.uomId,
        uomCode: uom?.code ?? '?',
        uomName: uom?.name ?? '?',
        stock: null,
        batches: [b],
        priceCount: 0,
        costCount: 0,
      })
    }
  }

  for (const p of data.priceCounts) {
    const key = `${p.branchId}:${p.uomId}`
    const existing = map.get(key)
    if (existing) existing.priceCount = p.n
  }
  for (const c of data.costCounts) {
    const key = `${c.branchId}:${c.uomId}`
    const existing = map.get(key)
    if (existing) existing.costCount = c.n
  }

  return Array.from(map.values()).sort((a, b) => a.branchName.localeCompare(b.branchName) || a.uomCode.localeCompare(b.uomCode))
}

export default function StockUomClient({ products, uoms }: Props) {
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [data, setData] = useState<StockUomData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function loadData(productId: string) {
    setErrorMsg(null)
    setSuccessMsg(null)
    if (!productId) {
      setData(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/bo/inventory/stock-uom?productId=${productId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal memuat data stok')
      setData(json)
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  function handleProductChange(value: string) {
    setSelectedProductId(value)
    loadData(value)
  }

  function refresh() {
    if (selectedProductId) loadData(selectedProductId)
  }

  async function handleDelete(group: UomGroup) {
    if (!data) return
    const key = `${group.branchId}:${group.uomId}`
    if (!confirm(`Hapus baris stok kosong untuk ${group.branchName} · ${group.uomCode}?`)) return

    setDeletingKey(key)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const res = await fetch('/api/bo/inventory/stock-uom/row', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: data.product.id, branchId: group.branchId, uomId: group.uomId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal menghapus baris stok')
      setSuccessMsg('Baris stok kosong berhasil dihapus')
      refresh()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setDeletingKey(null)
    }
  }

  const groups = data ? buildGroups(data, uoms) : []

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <ProductSelect
          products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
          value={selectedProductId}
          onChange={handleProductChange}
          placeholder="-- Cari produk --"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {data && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm">
            <span className="font-medium text-foreground">{data.product.name}</span>
            <span className="text-muted-foreground"> · Satuan dasar saat ini: </span>
            <span className="font-medium text-foreground">{data.product.baseUomCode}</span>
          </div>

          {groups.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Tidak ada baris stok atau batch untuk produk ini.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Cabang</th>
                    <th className="px-4 py-2 font-medium">Satuan</th>
                    <th className="px-4 py-2 font-medium text-right">Qty stok</th>
                    <th className="px-4 py-2 font-medium text-right">Batch (sisa)</th>
                    <th className="px-4 py-2 font-medium text-right">Harga / Modal</th>
                    <th className="px-4 py-2 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const key = `${g.branchId}:${g.uomId}`
                    const isBase = g.uomId === data.product.baseUomId
                    const totalBatchQty = g.batches.reduce((sum, b) => sum + b.qtyRemaining, 0)
                    const isEmpty = (g.stock?.qty ?? 0) === 0 && totalBatchQty === 0
                    return (
                      <tr key={key} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">{g.branchName}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-foreground">{g.uomCode}</span>
                          {isBase && (
                            <span className="ml-1.5 text-xs rounded bg-primary/10 text-primary px-1.5 py-0.5">
                              satuan dasar
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-foreground">{g.stock ? g.stock.qty : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-foreground">
                          {g.batches.length > 0 ? `${g.batches.length} (${totalBatchQty})` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">
                          {g.priceCount > 0 || g.costCount > 0
                            ? `${g.priceCount} harga, ${g.costCount} modal`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                          <button
                            disabled
                            title="Sementara dinonaktifkan — sedang diperbaiki, lihat catatan tim"
                            className="text-xs px-2.5 py-1 border border-border rounded-md opacity-40 cursor-not-allowed"
                          >
                            Pindahkan
                          </button>
                          <button
                            onClick={() => handleDelete(g)}
                            disabled={!isEmpty || deletingKey === key}
                            title={!isEmpty ? 'Masih ada stok — tidak bisa dihapus' : undefined}
                            className="text-xs px-2.5 py-1 border border-destructive/30 text-destructive rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {deletingKey === key ? 'Menghapus...' : 'Hapus'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
