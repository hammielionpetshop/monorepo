import Link from 'next/link'
import { Barcode, ClipboardList, PackageX } from 'lucide-react'

export default function ProdukHubPage() {
  return (
    <div className="max-w-md mx-auto p-4 space-y-3">
      <h1 className="text-lg font-bold text-foreground px-1">Kelola Produk</h1>

      <Link
        href="/pos/produk/barcode"
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors min-h-[72px]"
      >
        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          <Barcode className="w-6 h-6" />
        </span>
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">Tambah / Scan Barcode</span>
          <span className="text-sm text-muted-foreground">Pindai barcode produk lewat kamera HP</span>
        </span>
      </Link>

      <Link
        href="/pos/produk/stock-opname"
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors min-h-[72px]"
      >
        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          <ClipboardList className="w-6 h-6" />
        </span>
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">Stock Opname</span>
          <span className="text-sm text-muted-foreground">Hitung stok fisik & ajukan penyesuaian</span>
        </span>
      </Link>

      <Link
        href="/pos/produk/barang-rusak"
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors min-h-[72px]"
      >
        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-destructive/10 text-destructive flex-shrink-0">
          <PackageX className="w-6 h-6" />
        </span>
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">Barang Rusak</span>
          <span className="text-sm text-muted-foreground">Catat barang rusak/kadaluarsa/hilang & kurangi stok</span>
        </span>
      </Link>
    </div>
  )
}
