import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import AdjustmentLogsClient from './adjustment-logs-client'

describe('AdjustmentLogsClient', () => {
  it('renders filters, summary, and adjustment rows', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdjustmentLogsClient, {
        initialData: [
          {
            id: 1,
            productName: 'Dog Food',
            productSku: 'DOG-01',
            branchName: 'Bandung',
            adjustedByName: 'Admin',
            previousQty: 10,
            newQty: 12,
            deltaQty: '2',
            deltaFormatted: '+2',
            reason: 'Audit',
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ],
        branches: [],
      })
    )

    expect(html).toContain('Cari Produk')
    expect(html).toContain('Menampilkan 1 entri')
    expect(html).toContain('Dog Food')
  })
})
