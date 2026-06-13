'use client'

import { useState, useEffect } from 'react'
import ProductFormFields from './product-form-fields'
import type { Product, Category, Brand, Uom, ProductFormData } from './types'

interface Props {
  product?: Product | null
  categories: Category[]
  brands: Brand[]
  uoms: Uom[]
  onSuccess: () => void
  onCancel: () => void
}

export default function ProductForm({ product, categories, brands, uoms, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState<ProductFormData>({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    brandId: '',
    baseUomId: '',
    weightGram: '',
    defaultCostPrice: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        categoryId: product.categoryId?.toString() ?? '',
        brandId: product.brandId?.toString() ?? '',
        baseUomId: product.baseUomId.toString(),
        weightGram: product.weightGram != null ? String(product.weightGram) : '',
        defaultCostPrice: product.defaultCostPrice != null ? String(product.defaultCostPrice) : '',
      })
    }
  }, [product])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama produk wajib diisi')
      return
    }
    if (!form.baseUomId) {
      setErrorMsg('UOM dasar wajib dipilih')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        brandId: form.brandId ? Number(form.brandId) : null,
        baseUomId: Number(form.baseUomId),
        weightGram: form.weightGram.trim() || null,
        defaultCostPrice: form.defaultCostPrice.trim() ? Number(form.defaultCostPrice) : null,
      }

      const url = product
        ? `/api/bo/master-data/products/${product.id}`
        : '/api/bo/master-data/products'
      const method = product ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal ${product ? 'memperbarui' : 'menyimpan'} produk (${res.status})`)
        return
      }

      onSuccess()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ProductFormFields
        form={form}
        setForm={setForm}
        categories={categories}
        brands={brands}
        baseUoms={uoms}
        errorMsg={errorMsg}
      />

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : product ? 'Simpan Perubahan' : 'Tambah Produk'}
        </button>
      </div>
    </form>
  )
}
