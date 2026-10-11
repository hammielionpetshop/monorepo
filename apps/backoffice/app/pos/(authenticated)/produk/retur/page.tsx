import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ReturnTypeChooser } from '@/components/supplier-returns/return-type-chooser'

export default function ReturPilihanPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 space-y-4">
      <Link href="/pos/produk" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kelola Produk
      </Link>
      <div>
        <h1 className="text-lg font-bold text-foreground">Retur Barang</h1>
        <p className="text-sm text-muted-foreground">Barang ini mau dikembalikan ke mana? Pilih salah satu.</p>
      </div>
      <ReturnTypeChooser supplierHref="/pos/produk/retur-supplier" internalHref="/pos/produk/retur-internal" />
    </div>
  )
}
