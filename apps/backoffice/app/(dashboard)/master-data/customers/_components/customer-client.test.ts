import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import CustomerClient from './customer-client'

describe('CustomerClient', () => {
  it('renders search controls and customer data', () => {
    const html = renderToStaticMarkup(
      React.createElement(CustomerClient, {
        customers: [
          {
            id: 1,
            code: 'CUS-001',
            name: 'Budi',
            phone: '08123',
            email: 'budi@example.com',
            address: null,
            isActive: true,
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(html).toContain('Cari nama, kode, atau telepon...')
    expect(html).toContain('CUS-001')
    expect(html).toContain('Budi')
    expect(html).toContain('+ Tambah Customer')
  })
})
