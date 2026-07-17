'use client'

import React, { useState, useEffect } from 'react'
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
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
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

  const filtered = products.filter((p) => {
    if (categoryFilter && String(p.categoryId ?? '') !== categoryFilter) return false
    if (brandFilter && String(p.brandId ?? '') !== brandFilter) return false
    if (statusFilter === 'active' && !p.isActive) return false
    if (statusFilter === 'inactive' && p.isActive) return false

    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q)
    )
  })

  const hasFilter = Boolean(search.trim() || categoryFilter || brandFilter || statusFilter !== 'all')

  function resetFilter() {
    setSearch('')
    setCategoryFilter('')
    setBrandFilter('')
    setStatusFilter('all')
  }

  const selectClassName =
    'px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

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

      <ProductTable
        products={filtered}
        onEdit={openEditForm}
        onToggle={toggleActive}
        togglingId={togglingId}
        emptyMessage={
          hasFilter
            ? 'Tidak ada produk yang cocok dengan filter'
            : 'Belum ada produk. Klik "Tambah Produk" untuk menambahkan produk pertama.'
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, SKU, atau barcode..."
              className="flex-1 min-w-[12rem] max-w-xs px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter kategori"
              className={selectClassName}
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              aria-label="Filter brand"
              className={selectClassName}
            >
              <option value="">Semua Brand</option>
              {brands.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              aria-label="Filter status"
              className={selectClassName}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>

            {hasFilter && (
              <button
                onClick={resetFilter}
                className="px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors"
              >
                Reset
              </button>
            )}

            <button
              onClick={openAddForm}
              className="ml-auto px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              + Tambah Produk
            </button>
          </div>
        }
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
