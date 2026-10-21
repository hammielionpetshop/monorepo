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
            defaultTierType: 'RESELLER',
            isActive: true,
            canOrderOnline: false,
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(html).toContain('Cari nama, kode, atau telepon...')
    expect(html).toContain('CUS-001')
    expect(html).toContain('Budi')
    expect(html).toContain('+ Tambah Customer')
    expect(html).toContain('RESELLER')
  })

  it('lets an Owner/GM deactivate an active customer', () => {
    const html = renderToStaticMarkup(
      React.createElement(CustomerClient, {
        canManageStatus: true,
        customers: [
          {
            id: 1,
            code: 'CUS-001',
            name: 'Budi',
            phone: '08123',
            email: 'budi@example.com',
            address: null,
            defaultTierType: 'RETAIL',
            isActive: true,
            canOrderOnline: false,
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(html).toContain('Nonaktifkan customer Budi')
  })

  it('lets an Owner/GM reactivate an inactive customer', () => {
    const html = renderToStaticMarkup(
      React.createElement(CustomerClient, {
        canManageStatus: true,
        customers: [
          {
            id: 2,
            code: 'CUS-002',
            name: 'Siti',
            phone: null,
            email: null,
            address: null,
            defaultTierType: 'RETAIL',
            isActive: false,
            canOrderOnline: false,
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(html).toContain('Aktifkan customer Siti')
  })

  it('hides the status toggle when the user cannot manage status', () => {
    const html = renderToStaticMarkup(
      React.createElement(CustomerClient, {
        canManageStatus: false,
        customers: [
          {
            id: 3,
            code: 'CUS-003',
            name: 'Andi',
            phone: null,
            email: null,
            address: null,
            defaultTierType: 'RETAIL',
            isActive: true,
            canOrderOnline: false,
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(html).not.toContain('Nonaktifkan customer Andi')
  })
})
