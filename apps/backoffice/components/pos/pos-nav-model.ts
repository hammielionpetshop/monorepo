export type PosNavIcon =
  | 'cashier'
  | 'internalOrder'
  | 'incomingTransfer'
  | 'products'
  | 'history'
  | 'receivable'
  | 'shift'

export type PosNavItem = {
  readonly href: string
  readonly label: string
  readonly mobileLabel: string
  readonly icon: PosNavIcon
  readonly exact?: boolean
  readonly isVisible?: (role: string) => boolean
  readonly requiredPermission?: string
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
    href: '/pos/piutang',
    label: 'Piutang',
    mobileLabel: 'Piutang',
    icon: 'receivable',
    requiredPermission: 'debt.pay',
  },
  {
    href: '/pos/shift',
    label: 'Shift',
    mobileLabel: 'Shift',
    icon: 'shift',
  },
]

export function getVisiblePosNavItems(
  role: string,
  permissions: readonly string[] = [],
): readonly PosNavItem[] {
  return POS_NAV_ITEMS.filter(
    (item) =>
      (item.isVisible?.(role) ?? true) &&
      (!item.requiredPermission || permissions.includes(item.requiredPermission)),
  )
}

export function isPosNavItemActive(item: PosNavItem, pathname: string): boolean {
  if (item.exact) {
    return pathname === item.href
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
