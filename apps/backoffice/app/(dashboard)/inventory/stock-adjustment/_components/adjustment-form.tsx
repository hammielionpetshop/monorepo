'use client'

import { useState } from 'react'
import type { ProductWithStock } from '@/lib/services/stock-service'
import { ProductSelect } from '@/components/ui/product-select'

interface BranchOption { id: number; name: string }

interface Props {
  products: ProductWithStock[]
  branches: BranchOption[]
  defaultBranchId: number
}

export default function AdjustmentForm({ products: initialProducts, branches, defaultBranchId }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<number>(defaultBranchId)
  const [products, setProducts] = useState<ProductWithStock[]>(initialProducts)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [newQty, setNewQty] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const selectedProduct = products.find((p) => p.productId.toString() === selectedProductId)

  async function handleBranchChange(branchId: number) {
    setSelectedBranchId(branchId)
    setSelectedProductId('')
    setNewQty('')
    setErrorMsg(null)
    setSuccessMsg(null)
    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/bo/inventory/stock-adjustment?branchId=${branchId}`)
      if (res.ok) setProducts(await res.json())
    } finally {
      setLoadingProducts(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!reason.trim()) {
      setErrorMsg('Alasan penyesuaian wajib diisi')
      return
    }
    if (selectedProduct && newQty === selectedProduct.currentQty) {
      setErrorMsg('Kuantitas baru sama dengan stok saat ini, tidak ada perubahan')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bo/inventory/stock-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number(selectedProductId),
          newQty,
          reason: reason.trim(),
          ...(branches.length > 0 && { branchId: selectedBranchId }),
        }),
      })

      let data: any = {}
      const contentType = res.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await res.json()
      }

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menyimpan penyesuaian stok (${res.status})`)
        return
      }
      setSuccessMsg('Penyesuaian stok berhasil disimpan')
      // Reset form
      setSelectedProductId('')
      setNewQty('')
      setReason('')
    } catch (e) {
      console.error('Submit error:', e)
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      {branches.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Cabang</label>
          <select
            value={selectedBranchId}
            onChange={(e) => handleBranchChange(Number(e.target.value))}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Produk</label>
        <ProductSelect
          products={products.map((p) => ({
            id: p.productId,
            name: p.productName,
            sku: p.sku,
            currentQty: p.currentQty,
          }))}
          value={selectedProductId}
          onChange={(v) => { setSelectedProductId(v); setNewQty('') }}
          disabled={loadingProducts}
          loading={loadingProducts}
          showStock
        />
      </div>

      {selectedProduct && (
        <p className="text-xs text-muted-foreground">
          Stok saat ini: <span className="font-medium">{selectedProduct.currentQty}</span>
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Kuantitas Baru</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
          required
          placeholder="Masukkan jumlah stok yang sebenarnya"
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Alasan Penyesuaian <span className="text-destructive">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          placeholder="Contoh: Barang hilang saat stock opname, barang rusak tidak layak jual"
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedProductId}
        className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
      </button>
    </form>
  )
}
