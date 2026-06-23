'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  Clock3,
  History,
  PackageSearch,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from 'lucide-react'

import {
  getVisiblePosNavItems,
  isPosNavItemActive,
  type PosNavIcon,
} from './pos-nav-model'

const POS_NAV_ICONS: Record<PosNavIcon, LucideIcon> = {
  cashier: ShoppingCart,
  internalOrder: ClipboardList,
  incomingTransfer: Truck,
  products: PackageSearch,
  history: History,
  shift: Clock3,
}

export default function PosNavTabs({ role }: { role: string }) {
  const pathname = usePathname()

  const tabClass = (isActive: boolean) =>
    `group flex min-w-[72px] flex-1 items-center justify-center gap-1.5 px-2 py-2 text-center text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:min-w-0 sm:text-sm ${
      isActive
        ? 'bg-primary/10 text-primary font-semibold'
        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
    }`

  const items = getVisiblePosNavItems(role)

  return (
    <nav className="flex-shrink-0 border-b border-border bg-card print:hidden" aria-label="Navigasi POS">
      <div className="flex overflow-x-auto">
        {items.map((item) => {
          const Icon = POS_NAV_ICONS[item.icon]
          const isActive = isPosNavItemActive(item, pathname)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={tabClass(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate sm:hidden">{item.mobileLabel}</span>
              <span className="hidden truncate sm:inline">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
