import { describe, expect, it } from 'vitest'
import { canRequestRetur, returRequestPayloadSchema } from './retur-request-schema'

describe('returRequestPayloadSchema', () => {
  it('menerima muatan lengkap', () => {
    const parsed = returRequestPayloadSchema.safeParse({
      items: [{ transactionItemId: 5, qty: '2' }],
      estimatedRefund: 30000,
      display: [{ transactionItemId: 5, productName: 'ACTIVE -3', uomCode: 'SAK', qty: '2', unitPrice: 15000 }],
    })
    expect(parsed.success).toBe(true)
  })

  it('muatan lama tanpa display tetap terbaca', () => {
    const parsed = returRequestPayloadSchema.safeParse({ items: [{ transactionItemId: 5, qty: '1' }], estimatedRefund: 0 })
    expect(parsed.success && parsed.data.display).toEqual([])
  })

  it('item kosong atau qty bukan angka ditolak', () => {
    expect(returRequestPayloadSchema.safeParse({ items: [], estimatedRefund: 0 }).success).toBe(false)
    expect(
      returRequestPayloadSchema.safeParse({ items: [{ transactionItemId: 5, qty: '-1' }], estimatedRefund: 0 }).success,
    ).toBe(false)
  })
})

describe('canRequestRetur', () => {
  it('nota berlaku boleh diretur', () => {
    expect(canRequestRetur('COMPLETED')).toBe(true)
  })

  it('nota menunggu void atau sudah void tidak boleh', () => {
    expect(canRequestRetur('PENDING_VOID')).toBe(false)
    expect(canRequestRetur('VOIDED')).toBe(false)
  })
})
