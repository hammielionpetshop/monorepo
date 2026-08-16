'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/retur', label: 'Proses Retur' },
  { href: '/retur/riwayat', label: 'Riwayat Retur' },
]

export default function ReturTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Navigasi retur">
      {TABS.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
