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

type AdjustmentType = 'add' | 'subtract'

export default function AdjustmentForm({ products: initialProducts, branches, defaultBranchId }: Props) {
  const [selectedBranchId, setSelectedBranchId] = useState<number>(defaultBranchId)
  const [products, setProducts] = useState<ProductWithStock[]>(initialProducts)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedUomId, setSelectedUomId] = useState<number | null>(null)
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('subtract')
  const [qty, setQty] = useState<string>('')
  const [costPricePerUnit, setCostPricePerUnit] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const selectedProduct = products.find((p) => p.productId.toString() === selectedProductId)
  const selectedUom = selectedProduct?.uoms.find((u) => u.uomId === selectedUomId) ?? selectedProduct?.uoms[0]
  const ratio = selectedUom?.ratio ?? 1
  const isAdding = adjustmentType === 'add'

  const currentQtyBase = selectedProduct ? Number(selectedProduct.currentQty) : 0
  const qtyBase = qty === '' ? null : Number(qty) * ratio
  const finalQtyBase = qtyBase == null ? null : (isAdding ? currentQtyBase + qtyBase : currentQtyBase - qtyBase)
  const isInsufficient = finalQtyBase != null && finalQtyBase < 0

  function resetForProduct(uomId: number | null) {
    setSelectedUomId(uomId)
    setQty('')
    setCostPricePerUnit('')
  }

  async function handleBranchChange(branchId: number) {
    setSelectedBranchId(branchId)
    setSelectedProductId('')
    resetForProduct(null)
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
    if (qtyBase == null || qtyBase <= 0) {
      setErrorMsg('Jumlah penyesuaian harus lebih dari 0')
      return
    }
    if (isInsufficient) {
      setErrorMsg(`Stok tidak cukup untuk dikurangi. Tersedia: ${currentQtyBase} ${selectedProduct?.baseUomName ?? ''}`.trim())
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bo/inventory/stock-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number(selectedProductId),
          adjustmentType,
          qty,
          reason: reason.trim(),
          ...(selectedUomId != null && { uomId: selectedUomId }),
          ...(branches.length > 0 && { branchId: selectedBranchId }),
          ...(isAdding && costPricePerUnit !== '' && { costPricePerUnit: Math.round(Number(costPricePerUnit)) }),
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
      resetForProduct(null)
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
          onChange={(v) => {
            setSelectedProductId(v)
            const prod = products.find((p) => p.productId.toString() === v)
            resetForProduct(prod?.baseUomId ?? null)
          }}
          disabled={loadingProducts}
          loading={loadingProducts}
          showStock
        />
      </div>

      {selectedProduct && (
        <p className="text-sm text-muted-foreground">
          Stok saat ini: <span className="font-medium text-foreground">{selectedProduct.currentQty}</span>
          {selectedProduct.baseUomName && <span className="ml-1">{selectedProduct.baseUomName}</span>}
        </p>
      )}

      {selectedProduct && (
        <>
          {/* Mode: Tambah / Kurang */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjustmentType('add')}
              className={`py-2 px-4 rounded-md text-sm font-medium border transition-colors ${
                isAdding
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-background text-foreground border-input hover:bg-muted'
              }`}
            >
              + Tambah Stok
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentType('subtract')}
              className={`py-2 px-4 rounded-md text-sm font-medium border transition-colors ${
                !isAdding
                  ? 'bg-destructive text-white border-destructive'
                  : 'bg-background text-foreground border-input hover:bg-muted'
              }`}
            >
              − Kurangi Stok
            </button>
          </div>

          {/* Jumlah + satuan inline */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Jumlah {isAdding ? 'Penambahan' : 'Pengurangan'}
            </label>
            <div className="flex">
              <input
                type="number"
                min="0"
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                placeholder="0"
                className="w-full border border-input rounded-l-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:z-10"
              />
              <select
                value={selectedUomId ?? selectedProduct.baseUomId}
                onChange={(e) => setSelectedUomId(Number(e.target.value))}
                disabled={selectedProduct.uoms.length <= 1}
                className="border border-l-0 border-input rounded-r-md px-2 py-2 text-sm bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-100 disabled:cursor-default"
              >
                {selectedProduct.uoms.map((u) => (
                  <option key={u.uomId} value={u.uomId}>{u.name}</option>
                ))}
              </select>
            </div>
            {selectedUom && ratio !== 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                1 {selectedUom.name} = {ratio} {selectedProduct.baseUomName ?? 'satuan dasar'}
                {qtyBase != null && qtyBase > 0 && <> · {isAdding ? '+' : '−'}{qtyBase} {selectedProduct.baseUomName}</>}
              </p>
            )}
          </div>

          {/* Pratinjau stok akhir */}
          {qtyBase != null && qtyBase > 0 && (
            <div className={`text-sm rounded-md px-3 py-2 border ${
              isInsufficient
                ? 'bg-destructive/10 border-destructive/20 text-destructive'
                : 'bg-muted/50 border-input text-foreground'
            }`}>
              Stok akhir: <span className="font-semibold">{isInsufficient ? '—' : finalQtyBase}</span>
              {!isInsufficient && selectedProduct.baseUomName && <span className="ml-1">{selectedProduct.baseUomName}</span>}
              {isInsufficient && <span className="ml-1">(stok tidak cukup)</span>}
            </div>
          )}
        </>
      )}

      {selectedProduct && isAdding && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Harga Beli per {selectedUom?.name ?? 'Unit'} (HPP) <span className="text-muted-foreground text-xs">— opsional, untuk akurasi COGS</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={costPricePerUnit}
            onChange={(e) => setCostPricePerUnit(e.target.value)}
            placeholder="Contoh: 15000"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">Kosongkan jika harga beli tidak diketahui (HPP akan dianggap 0)</p>
        </div>
      )}

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
        disabled={isSubmitting || !selectedProductId || isInsufficient}
        className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
      </button>
    </form>
  )
}
