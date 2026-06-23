export type PosNavIcon =
  | 'cashier'
  | 'internalOrder'
  | 'incomingTransfer'
  | 'products'
  | 'history'
  | 'shift'

export type PosNavItem = {
  readonly href: string
  readonly label: string
  readonly mobileLabel: string
  readonly icon: PosNavIcon
  readonly exact?: boolean
  readonly isVisible?: (role: string) => boolean
}

export const POS_NAV_ITEMS: readonly PosNavItem[] = [
  {
    href: '/pos',
    label: 'Kasir',
    mobileLabel: 'Kasir',
    icon: 'cashier',
    exact: true,
  },
  {
    href: '/pos/internal-order',
    label: 'PO Internal',
    mobileLabel: 'PO',
    icon: 'internalOrder',
  },
  {
    href: '/pos/incoming-transfers',
    label: 'Transfer Masuk',
    mobileLabel: 'Transfer',
    icon: 'incomingTransfer',
    isVisible: (role) => role !== 'KASIR',
  },
  {
    href: '/pos/produk',
    label: 'Produk',
    mobileLabel: 'Produk',
    icon: 'products',
  },
  {
    href: '/pos/history',
    label: 'Riwayat',
    mobileLabel: 'Riwayat',
    icon: 'history',
  },
  {
    href: '/pos/shift',
    label: 'Shift',
    mobileLabel: 'Shift',
    icon: 'shift',
  },
]

export function getVisiblePosNavItems(role: string): readonly PosNavItem[] {
  return POS_NAV_ITEMS.filter((item) => item.isVisible?.(role) ?? true)
}

export function isPosNavItemActive(item: PosNavItem, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.href
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
