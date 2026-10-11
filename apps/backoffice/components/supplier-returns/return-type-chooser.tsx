import Link from 'next/link'
import { ArrowLeftRight, Truck } from 'lucide-react'

/**
 * Pintu masuk retur (RI3): kasir memilih jenis retur dulu lewat dua kotak besar.
 * Kotak "Retur Internal" belum bisa dipakai sampai layar Barang Dikembalikan (RI6) tayang.
 */
export function ReturnTypeChooser({ supplierHref }: { supplierHref: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        href={supplierHref}
        className="flex flex-col items-center gap-3 rounded-2xl border-2 border-amber-500/40 bg-card p-6 text-center transition-colors hover:bg-amber-500/5 hover:border-amber-500 min-h-[200px] justify-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
          <Truck className="h-9 w-9" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold text-foreground">Retur Supplier Luar</span>
        <span className="text-sm text-muted-foreground">
          Barang dari supplier (pabrik/distributor) yang rusak, expired, atau tidak datang — dikembalikan ke supplier
          dan tagihannya dipotong.
        </span>
      </Link>

      <div
        aria-disabled="true"
        className="relative flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/40 p-6 text-center min-h-[200px] justify-center cursor-not-allowed"
      >
        <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          Segera hadir
        </span>
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ArrowLeftRight className="h-9 w-9" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold text-muted-foreground">Retur Internal</span>
        <span className="text-sm text-muted-foreground">
          Barang kiriman cabang sendiri (Gudang atau toko lain) yang dikembalikan ke cabang pengirim. Belum bisa
          dipakai.
        </span>
      </div>
    </div>
  )
}
