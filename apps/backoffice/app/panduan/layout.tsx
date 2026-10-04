import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import TombolKembali from './_components/tombol-kembali'

export const metadata: Metadata = {
  title: 'Panduan — Hammielion',
  robots: { index: false, follow: false },
}

export default function PanduanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/panduan" className="flex items-center gap-2 text-lg font-black text-foreground">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            Panduan Hammielion
          </Link>
          <Suspense fallback={null}>
            <TombolKembali />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
    </div>
  )
}
