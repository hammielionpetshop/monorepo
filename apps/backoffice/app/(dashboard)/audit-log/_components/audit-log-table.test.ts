import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AuditLogTable } from './audit-log-table'

describe('AuditLogTable', () => {
  it('renders filter controls and loading state', () => {
    const html = renderToStaticMarkup(React.createElement(AuditLogTable))

    expect(html).toContain('Terapkan Filter')
    expect(html).toContain('Reset')
    expect(html).toContain('Memuat data...')
  })

  it('lists all known actions and legacy DB actions', () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditLogTable, { dbActions: ['PRICE_IMPORT', 'LEGACY_ACTION'] }),
    )

    expect(html).toContain('value="VOID_REQUEST_APPROVED"')
    expect(html).toContain('value="STOCK_BATCH_CORRECT_COST"')
    expect(html).toContain('value="LEGACY_ACTION"')
    expect(html.match(/value="PRICE_IMPORT"/g)).toHaveLength(1)
  })

  it('shows branch filter only when branches are provided', () => {
    const without = renderToStaticMarkup(React.createElement(AuditLogTable))
    expect(without).not.toContain('Semua Cabang')

    const withBranches = renderToStaticMarkup(
      React.createElement(AuditLogTable, { branches: [{ id: 1, name: 'Toko Pusat' }] }),
    )
    expect(withBranches).toContain('Semua Cabang')
    expect(withBranches).toContain('Toko Pusat')
  })
})
