import Link from 'next/link'
import { ArrowLeftRight, Truck } from 'lucide-react'
import { NewBadge } from '@/components/ui/new-badge'

/**
 * Pintu masuk retur (RI3): kasir memilih jenis retur dulu lewat dua kotak besar —
 * Retur Supplier Luar atau Retur Internal (layar Barang Dikembalikan, RI6).
 */
export function ReturnTypeChooser({ supplierHref, internalHref }: { supplierHref: string; internalHref: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        href={supplierHref}
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-amber-500/40 bg-card p-6 text-center transition-colors hover:bg-amber-500/5 hover:border-amber-500 min-h-[200px] justify-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
          <Truck className="h-9 w-9" aria-hidden="true" />
        </span>
        <span className="flex items-center gap-2 text-lg font-bold text-foreground">Retur Supplier Luar <NewBadge feature="retur-supplier-luar" /></span>
        <span className="text-sm text-muted-foreground">
          Barang dari supplier (pabrik/distributor) yang rusak, expired, atau tidak datang — dikembalikan ke supplier
          dan tagihannya dipotong.
        </span>
      </Link>

      <Link
        href={internalHref}
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-primary/40 bg-card p-6 text-center transition-colors hover:bg-primary/5 hover:border-primary min-h-[200px] justify-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ArrowLeftRight className="h-9 w-9" aria-hidden="true" />
        </span>
        <span className="flex items-center gap-2 text-lg font-bold text-foreground">Retur Internal <NewBadge feature="retur-internal" /></span>
        <span className="text-sm text-muted-foreground">
          Barang kiriman cabang sendiri (Gudang atau toko lain) yang tidak datang / salah kirim — dikembalikan ke
          cabang pengirim dan hutang internalnya dipotong.
        </span>
      </Link>
    </div>
  )
}
