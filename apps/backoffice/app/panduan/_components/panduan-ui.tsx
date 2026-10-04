import type { ReactNode } from 'react'
import { AlertTriangle, Ban, CircleHelp, Lightbulb, MapPin } from 'lucide-react'

export type Peran = 'kasir' | 'gm' | 'owner' | 'manager' | 'finance' | 'gudang'

const PERAN: Record<Peran, { label: string; className: string }> = {
  kasir: { label: 'Kasir', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  gm: { label: 'GM', className: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
  owner: { label: 'Owner', className: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
  manager: { label: 'Manager', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  finance: { label: 'Finance', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  gudang: { label: 'Gudang', className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
}

export function LabelPeran({ peran }: { peran: Peran }) {
  const p = PERAN[peran]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-bold ${p.className}`}>
      {p.label}
    </span>
  )
}

/** Tiruan tombol di layar, supaya pembaca mencari bentuk yang sama. */
export function Tombol({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-block whitespace-nowrap rounded-md border-2 border-foreground/70 bg-card px-2 py-0.5 text-[0.95em] font-bold text-foreground shadow-[0_2px_0_0_rgba(0,0,0,0.25)]">
      {children}
    </span>
  )
}

/** Nama menu/tab di aplikasi. */
export function Menu({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap rounded bg-primary/15 px-1.5 py-0.5 font-bold text-foreground">{children}</span>
}

const STATUS = {
  menunggu: { label: 'Menunggu Approval', className: 'bg-yellow-100 text-yellow-800' },
  disetujui: { label: 'Disetujui', className: 'bg-blue-100 text-blue-800' },
  disiapkan: { label: 'Sedang Disiapkan', className: 'bg-indigo-100 text-indigo-800' },
  dikirim: { label: 'Dalam Pengiriman', className: 'bg-orange-100 text-orange-800' },
  sebagian: { label: 'Diterima Sebagian', className: 'bg-amber-100 text-amber-800' },
  penuh: { label: 'Diterima Penuh', className: 'bg-green-100 text-green-800' },
  batal: { label: 'Dibatalkan', className: 'bg-red-100 text-red-700' },
} as const

export type Status = keyof typeof STATUS

/** Warna sama persis dengan badge status PO Internal di POS. */
export function LabelStatus({ status }: { status: Status }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

export function Langkah({
  nomor,
  judul,
  peran,
  tempat,
  children,
}: {
  nomor: number
  judul: string
  peran: { label: string; daftar: Peran[] }
  tempat?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby={`langkah-${nomor}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xl font-black text-primary-foreground sm:h-12 sm:w-12"
          aria-hidden
        >
          {nomor}
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={`langkah-${nomor}`} className="text-xl font-black leading-tight text-foreground sm:text-2xl">
            {judul}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{peran.label}:</span>
            {peran.daftar.map((p) => (
              <LabelPeran key={p} peran={p} />
            ))}
          </div>
          {tempat && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden />
              {tempat}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground sm:pl-16 sm:text-lg">{children}</div>
    </section>
  )
}

/** Daftar urutan klik. Satu baris = satu tindakan. */
export function Urutan({ children }: { children: ReactNode }) {
  return <ol className="list-none space-y-2.5 [counter-reset:urut]">{children}</ol>
}

export function Klik({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-9 [counter-increment:urut] before:absolute before:left-0 before:top-0.5 before:flex before:h-6 before:w-6 before:items-center before:justify-center before:rounded-full before:border-2 before:border-primary before:text-xs before:font-bold before:text-primary before:content-[counter(urut)]">
      {children}
    </li>
  )
}

const KOTAK = {
  jangan: {
    icon: Ban,
    judul: 'JANGAN',
    className: 'border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  penting: {
    icon: AlertTriangle,
    judul: 'PENTING',
    className: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  tips: {
    icon: Lightbulb,
    judul: 'TIPS',
    className: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100',
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
} as const

export function Kotak({ jenis, judul, children }: { jenis: keyof typeof KOTAK; judul?: string; children: ReactNode }) {
  const k = KOTAK[jenis]
  const Icon = k.icon
  return (
    <div className={`rounded-xl border-2 p-4 ${k.className}`}>
      <p className="flex items-center gap-2 text-base font-black tracking-wide">
        <Icon className={`h-5 w-5 flex-shrink-0 ${k.iconClass}`} aria-hidden />
        {judul ?? k.judul}
      </p>
      <div className="mt-2 space-y-2 text-base leading-relaxed">{children}</div>
    </div>
  )
}

export function KalauMaka({ kalau, children }: { kalau: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-border bg-card p-4 open:bg-muted/40">
      <summary className="flex cursor-pointer list-none items-start gap-2 text-lg font-bold text-foreground">
        <CircleHelp className="mt-1 h-5 w-5 flex-shrink-0 text-primary" aria-hidden />
        <span className="flex-1">{kalau}</span>
        <span className="text-sm font-semibold text-primary group-open:hidden">Lihat</span>
      </summary>
      <div className="mt-3 space-y-2 pl-7 text-base leading-relaxed text-foreground">{children}</div>
    </details>
  )
}
