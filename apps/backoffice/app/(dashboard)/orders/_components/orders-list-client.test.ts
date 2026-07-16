import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OrdersListClient } from './orders-list-client'

describe('OrdersListClient', () => {
  it('renders tabs and the pending order row', () => {
    const html = renderToStaticMarkup(
      React.createElement(OrdersListClient, {
        orders: [
          {
            id: 1,
            orderNumber: 'SO-001',
            customerName: 'Budi',
            customerPhone: '08123',
            itemCount: 2,
            estimatedTotal: 150000,
            status: 'PENDING',
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(html).toContain('Menunggu')
    expect(html).toContain('SO-001')
    expect(html).toContain('Rp 150.000')
  })
})
