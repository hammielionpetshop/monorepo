import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import SupplierClient from './supplier-client'

describe('SupplierClient', () => {
  it('renders search controls and supplier data', () => {
    const html = renderToStaticMarkup(
      React.createElement(SupplierClient, {
        suppliers: [
          {
            id: 1,
            name: 'PT Maju',
            contactPerson: 'Sari',
            phone: '08111',
            email: 'sari@example.com',
            bankAccount: null,
            address: null,
            paymentTermDays: 14,
          },
        ],
      })
    )

    expect(html).toContain('Cari nama, telepon, atau kontak...')
    expect(html).toContain('PT Maju')
    expect(html).toContain('14 hari')
    expect(html).toContain('+ Tambah Supplier')
  })
})
