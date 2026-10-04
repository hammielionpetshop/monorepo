import Link from 'next/link'
import { ArrowRight, ClipboardList, Clock3, PackageCheck, Truck, type LucideIcon } from 'lucide-react'

interface KartuPanduan {
  href?: string
  icon: LucideIcon
  judul: string
  isi: string
  untuk: string
}

const DAFTAR: KartuPanduan[] = [
  {
    href: '/panduan/po-internal',
    icon: Truck,
    judul: 'Minta Barang ke Cabang Lain',
    isi: 'PO Internal: dari menulis permintaan sampai barang diterima.',
    untuk: 'Kasir, GM, Owner',
  },
  {
    icon: ClipboardList,
    judul: 'Pesan Barang ke Supplier',
    isi: 'Purchase Order ke supplier luar.',
    untuk: 'Manager, GM, Owner',
  },
  {
    icon: Clock3,
    judul: 'Buka & Tutup Shift',
    isi: 'Mulai jaga kasir sampai setor uang.',
    untuk: 'Kasir',
  },
  {
    icon: PackageCheck,
    judul: 'Hitung Stok (Stock Opname)',
    isi: 'Mencocokkan stok di rak dengan di sistem.',
    untuk: 'Kasir, Gudang, Manager',
  },
]

export default function PanduanPage() {
  return (
    <div>
      <h1 className="text-3xl font-black leading-tight text-foreground sm:text-4xl">Mau belajar apa hari ini?</h1>
      <p className="mt-2 text-lg text-muted-foreground">Pilih salah satu. Setiap panduan dijelaskan langkah demi langkah.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {DAFTAR.map((k) => {
          const Icon = k.icon
          const isi = (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Icon className="h-7 w-7" aria-hidden />
              </div>
              <h2 className="mt-4 text-xl font-black leading-tight text-foreground">{k.judul}</h2>
              <p className="mt-1 text-base text-muted-foreground">{k.isi}</p>
              <p className="mt-3 text-sm font-semibold text-foreground">Untuk: {k.untuk}</p>
              {k.href ? (
                <span className="mt-4 inline-flex items-center gap-1.5 text-base font-bold text-primary">
                  Baca panduan <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              ) : (
                <span className="mt-4 inline-block rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
                  Segera hadir
                </span>
              )}
            </>
          )
          return k.href ? (
            <Link
              key={k.judul}
              href={k.href}
              className="rounded-2xl border-2 border-border bg-card p-5 transition-all hover:border-primary active:scale-[0.98]"
            >
              {isi}
            </Link>
          ) : (
            <div key={k.judul} className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-5 opacity-70">
              {isi}
            </div>
          )
        })}
      </div>
    </div>
  )
}
