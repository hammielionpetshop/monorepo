'use client'

import type { Product } from './types'

interface ProductTableProps {
  products: Product[]
  onEdit: (product: Product) => void
  onToggle: (product: Product) => void
  togglingId: number | null
}

export default function ProductTable({ products, onEdit, onToggle, togglingId }: ProductTableProps) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Barcode</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kategori</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Brand</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">UOM Dasar</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.sku ?? '-'}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.barcode ?? '-'}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.categoryName ?? '-'}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.brandName ?? '-'}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.uomName ?? '-'} ({p.uomCode ?? '-'})</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(p)}
                      className="px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onToggle(p)}
                      disabled={togglingId === p.id}
                      className={`px-2.5 py-1 text-xs font-medium border rounded-md transition-colors disabled:opacity-50 ${
                        p.isActive
                          ? 'text-destructive border-destructive/30 hover:bg-destructive/10'
                          : 'text-green-700 border-green-300 hover:bg-green-50'
                      }`}
                    >
                      {togglingId === p.id ? '...' : p.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Belum ada produk. Klik &quot;Tambah Produk&quot; untuk menambahkan produk pertama.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
