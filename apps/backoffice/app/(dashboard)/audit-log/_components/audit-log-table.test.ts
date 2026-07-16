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
})
