'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Menu,
  X,
  Monitor,
  Receipt,
  RotateCcw,
  ClipboardList,
  SlidersHorizontal,
  ArrowLeftRight,
  ClipboardCheck,
  ShoppingCart,
  LayoutDashboard,
  TrendingUp,
  PackageSearch,
  Clock,
  Box,
  Tag,
  FolderOpen,
  Ruler,
  Users,
  UserCog,
  Store,
  FileText,
  Package,
  Database,
  Settings,
  BarChart2,
  ChevronDown,
  DollarSign,
  HandCoins,
  CreditCard,
  Wallet,
  Barcode,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles?: string[]
}

interface NavGroup {
  id: string
  label: string
  icon?: LucideIcon
  collapsible: boolean
  items: NavItem[]
}

interface SidebarProps {
  role: string
  userName: string
  branchName: string
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operasional',
    label: 'Operasional',
    collapsible: false,
    items: [
      { href: '/pos', label: 'Web POS', icon: Monitor },
    ],
  },
  {
    id: 'transaksi',
    label: 'Transaksi',
    icon: Receipt,
    collapsible: true,
    items: [
      { href: '/transactions', label: 'Transaksi', icon: Receipt },
      { href: '/transactions/bulk-sale', label: 'Bulk Sale', icon: ShoppingCart, roles: ['OWNER', 'GM', 'MANAGER'] },
      { href: '/retur', label: 'Manajemen Retur', icon: RotateCcw },
    ],
  },
  {
    id: 'inventori',
    label: 'Inventori',
    icon: Package,
    collapsible: true,
    items: [
      { href: '/inventory/stock-adjustment', label: 'Penyesuaian Stok', icon: SlidersHorizontal },
      { href: '/inventory/stock-logs', label: 'Mutasi Stok', icon: ArrowLeftRight },
      { href: '/inventory/stock-opname', label: 'Stock Opname', icon: ClipboardCheck },
    ],
  },
  {
    id: 'pembelian',
    label: 'Pembelian',
    icon: ShoppingCart,
    collapsible: true,
    items: [
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
      { href: '/purchase-orders/internal', label: 'Transfer Internal', icon: ArrowLeftRight },
      { href: '/purchase-orders/internal/payables', label: 'Hutang Piutang Internal', icon: Receipt },
    ],
  },
  {
    id: 'laporan',
    label: 'Laporan',
    icon: BarChart2,
    collapsible: true,
    items: [
      { href: '/reports/profit-loss', label: 'Laporan Laba Rugi', icon: TrendingUp },
      { href: '/reports/stock-valuation', label: 'Laporan Nilai Stok', icon: PackageSearch },
      { href: '/reports/receivables', label: 'Piutang', icon: HandCoins },
    ],
  },
  {
    id: 'keuangan',
    label: 'Keuangan',
    icon: Wallet,
    collapsible: true,
    items: [
      { href: '/cash-flow', label: 'Pendapatan & Pengeluaran', icon: HandCoins },
      { href: '/cash-flow/categories', label: 'Kategori Kas', icon: FolderOpen, roles: ['OWNER', 'GM', 'MANAGER'] },
    ],
  },
  {
    id: 'shift',
    label: 'Shift',
    icon: Clock,
    collapsible: true,
    items: [
      { href: '/shift-history', label: 'Riwayat Shift', icon: Clock, roles: ['OWNER', 'GM'] },
    ],
  },
  {
    id: 'master-data',
    label: 'Master Data',
    icon: Database,
    collapsible: true,
    items: [
      { href: '/master-data/products', label: 'Produk', icon: Box },
      { href: '/master-data/products/barcode-print', label: 'Cetak Barcode', icon: Barcode },
      { href: '/master-data/prices', label: 'Manajemen Harga', icon: DollarSign },
      { href: '/master-data/brands', label: 'Brand', icon: Tag },
      { href: '/master-data/categories', label: 'Kategori', icon: FolderOpen },
      { href: '/master-data/uom', label: 'Satuan Ukur', icon: Ruler },
      { href: '/master-data/customers', label: 'Customer', icon: Users },
      { href: '/master-data/suppliers', label: 'Supplier', icon: Store },
      { href: '/master-data/payment-methods', label: 'Metode Pembayaran', icon: CreditCard },
    ],
  },
  {
    id: 'pengaturan',
    label: 'Pengaturan',
    icon: Settings,
    collapsible: true,
    items: [
      { href: '/settings/users', label: 'Pengguna', icon: UserCog },
      { href: '/settings/branches', label: 'Cabang', icon: Store },
    ],
  },
  {
    id: 'lainnya',
    label: 'Lainnya',
    collapsible: false,
    items: [
      { href: '/audit-log', label: 'Audit Log', icon: ClipboardList },
      { href: '/changelog', label: 'Changelog', icon: FileText },
    ],
  },
]

const STORAGE_KEY = 'sidebar-collapsed-groups'

function getInitialCollapsedState(pathname: string): Record<string, boolean> {
  let stored: Record<string, boolean> = {}
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) stored = JSON.parse(raw) as Record<string, boolean>
    } catch {
      // abaikan error parsing
    }
  }

  const result: Record<string, boolean> = {}
  for (const group of NAV_GROUPS) {
    if (!group.collapsible) continue

    const hasActiveItem = group.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/')
    )

    if (hasActiveItem) {
      result[group.id] = false
    } else if (group.id in stored) {
      result[group.id] = stored[group.id]
    } else {
      result[group.id] = true
    }
  }
  return result
}

export default function Sidebar({ role, userName, branchName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsed(getInitialCollapsedState(pathname))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tutup drawer otomatis saat pindah halaman
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Kunci scroll body saat drawer terbuka
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  function toggleGroup(groupId: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // abaikan error storage
      }
      return next
    })
  }

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5 border-b border-border/50">
        <h2 className="text-base font-bold text-foreground">Hammielion</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Backoffice</p>
      </div>

      <nav className="p-3 flex-1 overflow-y-auto space-y-0.5">
        <Link
          href="/dashboard"
          className={[
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors mb-1',
            isActive('/dashboard')
              ? 'bg-primary/10 text-primary font-semibold'
              : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
          ].join(' ')}
        >
          <LayoutDashboard size={15} />
          Dashboard
        </Link>

        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(role)
          )
          if (visibleItems.length === 0) return null

          const isCollapsed = group.collapsible ? (collapsed[group.id] ?? true) : false

          return (
            <div key={group.id} className="mb-1">
              {group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    {group.icon && <group.icon size={13} />}
                    <span>{group.label}</span>
                  </div>
                  <span
                    className="transition-transform duration-200"
                    style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
                  >
                    <ChevronDown size={13} />
                  </span>
                </button>
              ) : (
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}

              <div
                className="overflow-hidden transition-all duration-200"
                style={{ maxHeight: isCollapsed ? '0px' : '500px', opacity: isCollapsed ? 0 : 1 }}
              >
                <div className="space-y-0.5 pt-0.5 pl-2">
                  {visibleItems.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                          active
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
                        ].join(' ')}
                      >
                        <item.icon size={15} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border/50">
        <p className="text-xs font-medium text-foreground truncate">{userName}</p>
        <p className="text-xs text-muted-foreground truncate">{branchName}</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Tombol hamburger — hanya mobile */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Buka menu"
        aria-expanded={mobileOpen}
        className="fixed left-3 top-2.5 z-30 inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar statis — desktop */}
      <aside className="hidden md:flex w-60 bg-card shadow-sm flex-shrink-0 flex-col border-r border-border">
        {navContent}
      </aside>

      {/* Backdrop drawer — mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer geser — mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[80vw] bg-card border-r border-border shadow-xl flex flex-col transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
          className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={18} />
        </button>
        {navContent}
      </aside>
    </>
  )
}
