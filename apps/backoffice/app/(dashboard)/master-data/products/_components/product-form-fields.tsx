'use client'

import type { ProductFormData, Category, Brand, Uom } from './types'

interface Props {
  form: ProductFormData
  setForm: React.Dispatch<React.SetStateAction<ProductFormData>>
  categories: Category[]
  brands: Brand[]
  baseUoms: Uom[]
  errorMsg: string | null
}

export default function ProductFormFields({ form, setForm, categories, brands, baseUoms, errorMsg }: Props) {
  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Nama Produk <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Masukkan nama produk"
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">SKU</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            placeholder="Opsional"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Barcode</label>
          <input
            type="text"
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            placeholder="Opsional"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Kategori</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">-- Pilih kategori --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id.toString()}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Brand</label>
          <select
            value={form.brandId}
            onChange={(e) => setForm({ ...form, brandId: e.target.value })}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">-- Pilih brand --</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id.toString()}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            UOM Dasar <span className="text-destructive">*</span>
          </label>
          <select
            value={form.baseUomId}
            onChange={(e) => setForm({ ...form, baseUomId: e.target.value })}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">-- Pilih UOM --</option>
            {baseUoms.map((u) => (
              <option key={u.id} value={u.id.toString()}>{u.name} ({u.code})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Berat (gram)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.weightGram}
            onChange={(e) => setForm({ ...form, weightGram: e.target.value })}
            placeholder="Opsional"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Harga Modal Default (per UOM Dasar)
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={form.defaultCostPrice}
          onChange={(e) => setForm({ ...form, defaultCostPrice: e.target.value })}
          placeholder="Opsional — digunakan jika data FIFO tidak tersedia"
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Digunakan sebagai fallback HPP di laporan laba rugi bila data batch stok belum ada.
        </p>
      </div>
    </div>
  )
}
