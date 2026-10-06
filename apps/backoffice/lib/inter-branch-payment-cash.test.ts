import { describe, expect, it } from 'vitest'
import { buildInterBranchPaymentCashEntries } from './inter-branch-payment-cash'

const base = {
  amount: 2_480_000,
  ibtNumber: 'IBT-20261007-0001',
  debtorBranchId: 2,
  debtorBranchName: 'Toko Depan',
  creditorBranchId: 4,
  creditorBranchName: 'Gudang',
  paymentMethodName: 'TRANSFER BCA',
}

describe('buildInterBranchPaymentCashEntries', () => {
  it('pengeluaran di cabang pembayar, pendapatan di cabang penerima, nominal sama', () => {
    const [keluar, masuk] = buildInterBranchPaymentCashEntries(base)
    expect(keluar).toMatchObject({ type: 'EXPENSE', branchId: 2, amount: 2_480_000, category: 'Bayar Hutang Internal' })
    expect(masuk).toMatchObject({ type: 'INCOME', branchId: 4, amount: 2_480_000, category: 'Terima Piutang Internal' })
  })

  it('catatan menyebut nomor PO Internal, metode bayar, dan referensi', () => {
    const [keluar, masuk] = buildInterBranchPaymentCashEntries({ ...base, referenceNumber: ' TRF-889 ' })
    expect(keluar.note).toBe('Bayar hutang internal ke Gudang, IBT-20261007-0001 · TRANSFER BCA · ref TRF-889')
    expect(masuk.note).toBe('Terima piutang internal dari Toko Depan, IBT-20261007-0001 · TRANSFER BCA · ref TRF-889')
  })

  it('catatan tidak melebihi 255 karakter', () => {
    const [keluar] = buildInterBranchPaymentCashEntries({ ...base, referenceNumber: 'x'.repeat(400) })
    expect(keluar.note.length).toBe(255)
  })
})
