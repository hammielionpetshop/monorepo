import Link from 'next/link'
import { Barcode, ClipboardList } from 'lucide-react'

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

      <div
        aria-disabled="true"
        className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl opacity-60 cursor-not-allowed min-h-[72px]"
      >
        <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted text-muted-foreground flex-shrink-0">
          <ClipboardList className="w-6 h-6" />
        </span>
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">
            Stock Opname
            <span className="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Segera hadir
            </span>
          </span>
          <span className="text-sm text-muted-foreground">Hitung stok fisik & ajukan penyesuaian</span>
        </span>
      </div>
    </div>
  )
}
