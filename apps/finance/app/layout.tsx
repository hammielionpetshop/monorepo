import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hammielion — Finance (staging)',
  description: 'Analisa uang Hammielion Petshop: Saldo Tempat Uang, Arus Uang, dan Laba Rugi. Hanya membaca.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="antialiased">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <span className="font-semibold">
              Finance <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">staging · hanya membaca</span>
            </span>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-primary">Saldo</Link>
              <Link href="/arus-uang" className="hover:text-primary">Arus Uang</Link>
              <Link href="/laba-rugi" className="hover:text-primary">Laba Rugi</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
