'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function PosNavTabs({ role }: { role: string }) {
  const pathname = usePathname()

  const tabClass = (isActive: boolean) =>
    `flex-1 text-center text-sm font-medium min-h-[44px] flex items-center justify-center transition-colors print:hidden ${
      isActive
        ? 'border-b-2 border-primary text-primary font-semibold'
        : 'text-muted-foreground hover:text-foreground'
    }`

  const canReceive = role !== 'KASIR'

  return (
    <nav className="flex border-b border-border bg-card flex-shrink-0 print:hidden" aria-label="Navigasi POS">
      <Link href="/pos" className={tabClass(pathname === '/pos')}>
        Kasir
      </Link>
      {canReceive && (
        <Link href="/pos/receiving" className={tabClass(pathname.startsWith('/pos/receiving'))}>
          Penerimaan
        </Link>
      )}
      <Link href="/pos/internal-order" className={tabClass(pathname.startsWith('/pos/internal-order'))}>
        PO Internal
      </Link>
      {canReceive && (
        <Link href="/pos/incoming-transfers" className={tabClass(pathname.startsWith('/pos/incoming-transfers'))}>
          Transfer Masuk
        </Link>
      )}
      <Link href="/pos/history" className={tabClass(pathname.startsWith('/pos/history'))}>
        History
      </Link>
      <Link href="/pos/shift" className={tabClass(pathname.startsWith('/pos/shift'))}>
        Shift
      </Link>
    </nav>
  )
}
