'use client'

import { useState, useEffect } from 'react'
import ProductForm from './product-form'
import ProductTable from './product-table'
import type { Product, Category, Brand, Uom } from './types'

interface Props {
  products: Product[]
  categories: Category[]
  brands: Brand[]
  uoms: Uom[]
}

export default function ProductClient({ products: initialProducts, categories, brands, uoms }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (!showForm) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeForm()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [showForm])

  async function refreshProducts() {
    try {
      const res = await fetch('/api/bo/master-data/products')
      if (!res.ok) {
        setErrorMsg('Gagal memperbarui daftar produk')
        return
      }
      const data = await res.json()
      setProducts(data)
      setErrorMsg(null)
    } catch {
      setErrorMsg('Gagal memperbarui daftar produk')
    }
  }

  function openAddForm() {
    setEditingProduct(null)
    setShowForm(true)
  }

  function openEditForm(product: Product) {
    setEditingProduct(product)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingProduct(null)
  }

  async function handleSuccess() {
    setSuccessMsg(editingProduct ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan')
    closeForm()
    await refreshProducts()
  }

  async function toggleActive(product: Product) {
    const confirmed = window.confirm(
      product.isActive
        ? `Nonaktifkan produk "${product.name}"? Produk tidak akan muncul di POS.`
        : `Aktifkan produk "${product.name}"?`
    )
    if (!confirmed) return

    setTogglingId(product.id)
    try {
      const res = await fetch(`/api/bo/master-data/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Gagal mengubah status produk')
        return
      }

      setSuccessMsg(
        product.isActive
          ? `Produk "${product.name}" dinonaktifkan`
          : `Produk "${product.name}" diaktifkan`
      )
      await refreshProducts()
    } catch {
      alert('Terjadi kesalahan jaringan')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <>
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={openAddForm}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          + Tambah Produk
        </button>
      </div>

      <ProductTable
        products={products}
        onEdit={openEditForm}
        onToggle={toggleActive}
        togglingId={togglingId}
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <ProductForm
                product={editingProduct}
                categories={categories}
                brands={brands}
                uoms={uoms}
                onSuccess={handleSuccess}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
