import { describe, expect, it } from 'vitest'
import { transactionEditPayloadSchema } from './transaction-edit-schema'

const item = {
  transactionItemId: 10,
  productId: 5,
  uomId: 2,
  qty: 3,
  unitPrice: 12000,
  discountAmount: 0,
  priceTier: 'RETAIL',
}

const payment = { paymentMethodId: 1, amount: 36000 }

const valid = { items: [item], payments: [payment] }

describe('transactionEditPayloadSchema', () => {
  it('menerima muatan koreksi yang lengkap', () => {
    expect(transactionEditPayloadSchema.safeParse(valid).success).toBe(true)
  })

  it('item baru boleh tanpa transactionItemId', () => {
    const parsed = transactionEditPayloadSchema.safeParse({
      ...valid,
      items: [{ ...item, transactionItemId: null }],
    })
    expect(parsed.success).toBe(true)
  })

  it('menolak koreksi yang mengosongkan seluruh item', () => {
    // Nota tanpa item bukan koreksi — itu void, dan jalurnya berbeda.
    const parsed = transactionEditPayloadSchema.safeParse({ ...valid, items: [] })
    expect(parsed.success).toBe(false)
  })

  it('menolak qty nol atau negatif', () => {
    expect(
      transactionEditPayloadSchema.safeParse({ ...valid, items: [{ ...item, qty: 0 }] }).success,
    ).toBe(false)
    expect(
      transactionEditPayloadSchema.safeParse({ ...valid, items: [{ ...item, qty: -2 }] }).success,
    ).toBe(false)
  })

  it('menolak harga pecahan — rupiah disimpan sebagai integer', () => {
    const parsed = transactionEditPayloadSchema.safeParse({
      ...valid,
      items: [{ ...item, unitPrice: 12000.5 }],
    })
    expect(parsed.success).toBe(false)
  })

  it('menolak muatan tanpa pembayaran', () => {
    expect(transactionEditPayloadSchema.safeParse({ ...valid, payments: [] }).success).toBe(false)
  })

  it('menolak muatan null — jaga penerapan koreksi dari payload kosong', () => {
    // Inilah yang diperiksa saat permintaan disetujui: muatan yang disimpan bisa saja
    // kosong atau bentuknya berubah, dan menerapkannya berarti menyetujui sesuatu yang
    // tak seorang pun pernah lihat.
    expect(transactionEditPayloadSchema.safeParse(null).success).toBe(false)
    expect(transactionEditPayloadSchema.safeParse({}).success).toBe(false)
  })
})
