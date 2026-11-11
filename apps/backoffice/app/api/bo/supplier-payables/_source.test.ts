import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {}, moneyPlaces: {}, paymentMethods: {}, eq: vi.fn(), sql: vi.fn() }))

import { checkPaymentSource, requiredSourceKind } from './_source'

const cash = { name: 'TUNAI', type: 'CASH' }
const transfer = { name: 'TRANSFER BCA', type: 'BANK_TRANSFER' }

describe('aturan Dibayar dari pembayaran supplier (F2-4a)', () => {
  it('tunai butuh tempat Tunai, non-tunai butuh Rekening', () => {
    expect(requiredSourceKind(cash)).toBe('CASH')
    expect(requiredSourceKind(transfer)).toBe('BANK')
    expect(requiredSourceKind({ name: 'Cek' })).toBe('BANK')
    expect(requiredSourceKind({ name: 'Tunai' })).toBe('CASH')
  })

  it('menerima pasangan yang cocok', () => {
    expect(checkPaymentSource(cash, { id: 1, kind: 'CASH', isActive: true })).toBeNull()
    expect(checkPaymentSource(transfer, { id: 2, kind: 'BANK', isActive: true })).toBeNull()
  })

  it('menolak tanpa tempat, laci, nonaktif, dan jenis tidak cocok', () => {
    expect(checkPaymentSource(cash, null)).toMatch(/Dibayar dari/)
    expect(checkPaymentSource(cash, { id: 3, kind: 'DRAWER', isActive: true })).toMatch(/Laci/)
    expect(checkPaymentSource(cash, { id: 1, kind: 'CASH', isActive: false })).toMatch(/nonaktif/)
    expect(checkPaymentSource(cash, { id: 2, kind: 'BANK', isActive: true })).toMatch(/Tunai/)
    expect(checkPaymentSource(transfer, { id: 1, kind: 'CASH', isActive: true })).toMatch(/Rekening/)
  })
})
