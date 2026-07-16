import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import StockLogsClient from './stock-logs-client'

describe('StockLogsClient', () => {
  it('renders filters, summary, and stock rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(StockLogsClient, {
        initialData: [
          {
            id: 'PO_1',
            createdAt: '2026-07-16T10:00:00.000Z',
            movementType: 'PO_IN',
            productName: 'Dog Food',
            productSku: 'DOG-01',
            branchName: 'Bandung',
            uomCode: 'PCS',
            qtyChange: 5,
            unitPrice: 10000,
            cogs: 10000,
            referenceNumber: 'PO-001',
            actorName: 'Admin',
            notes: 'Restock',
          },
        ],
        initialError: null,
        branches: [],
        defaultFrom: '2026-07-01',
        defaultTo: '2026-07-16',
        isGlobal: false,
      })
    )

    expect(html).toContain('Cari nama atau SKU produk...')
    expect(html).toContain('Menampilkan')
    expect(html).toContain('Dog Food')
  })
})
