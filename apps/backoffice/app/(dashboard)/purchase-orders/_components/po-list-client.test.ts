import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { POListClient } from './po-list-client'

describe('POListClient', () => {
  it('renders tabs, create button, and purchase order data', () => {
    const html = renderToStaticMarkup(
      React.createElement(POListClient, {
        pos: [
          {
            id: 1,
            poNumber: 'PO-001',
            status: 'PENDING_APPROVAL',
            totalAmount: '250000',
            notes: null,
            createdAt: '2026-07-16T10:00:00.000Z',
            supplier: { id: 1, name: 'PT Maju' },
            branch: { id: 1, name: 'Bandung' },
          },
        ],
        suppliers: [],
        branches: [],
        currentUserId: 1,
        role: 'OWNER',
      })
    )

    expect(html).toContain('Menunggu')
    expect(html).toContain('+ Buat PO')
    expect(html).toContain('PO-001')
  })
})
