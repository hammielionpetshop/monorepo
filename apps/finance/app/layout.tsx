import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { gatewayUrl } from '@/lib/access';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hammielion — Finance (staging)',
  description: 'Analisa uang Hammielion Petshop: Saldo Tempat Uang, Arus Uang, Laba Rugi, Setoran vs Laba, Utang Antar Cabang, Dana Belum Cair, Hitung Kas, dan Tutup Bulan. Hanya membaca, kecuali menutup bulan.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Web Finance hanya untuk Owner/GM yang selalu punya POS juga, jadi tombol Pindah web selalu berguna (spec F2-7a §4).
  const switchUrl = gatewayUrl('/?dari=finance');
  return (
    <html lang="id">
      <body className="antialiased">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <span className="font-semibold">
              Finance <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">staging · membaca (+ tutup bulan)</span>
            </span>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href="/" className="hover:text-primary">Saldo</Link>
              <Link href="/cash-flow" className="hover:text-primary">Arus Uang</Link>
              <Link href="/profit-loss" className="hover:text-primary">Laba Rugi</Link>
              <Link href="/deposits-vs-profit" className="hover:text-primary">Setoran vs Laba</Link>
              <Link href="/inter-branch-debts" className="hover:text-primary">Utang Antar Cabang</Link>
              <Link href="/pending-funds" className="hover:text-primary">Dana Belum Cair</Link>
              <Link href="/cash-counts" className="hover:text-primary">Hitung Kas</Link>
              <Link href="/month-close" className="hover:text-primary">Tutup Bulan</Link>
            </nav>
            {switchUrl && (
              <a href={switchUrl} className="ml-auto rounded-md border border-border px-3 py-1 text-sm hover:bg-muted">Pindah web</a>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
