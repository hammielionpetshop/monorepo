import { describe, expect, it } from 'vitest'
import { poPaymentBadge } from './po-payment-status'

const today = '2026-10-10'
const payable = (over: Partial<{ status: string; dueDate: string | null }> = {}) => ({
  status: 'UNPAID',
  totalAmount: 1_000_000,
  paidAmount: 0,
  dueDate: '2026-10-20',
  ...over,
})

describe('poPaymentBadge', () => {
  it('belum ada hutang (barang belum masuk) → tanpa label', () => {
    expect(poPaymentBadge('DISETUJUI', null, today)).toBeNull()
  })

  it('harga belum lengkap → Menunggu Faktur, bukan Belum Bayar', () => {
    expect(poPaymentBadge('BELUM_HARGA', payable(), today)?.label).toBe('Menunggu Faktur')
  })

  it('status bayar biasa', () => {
    expect(poPaymentBadge('SELESAI', payable(), today)?.label).toBe('Belum Bayar')
    expect(poPaymentBadge('SELESAI', payable({ status: 'PARTIAL' }), today)?.label).toBe('Sebagian')
    expect(poPaymentBadge('SELESAI', payable({ status: 'PAID', dueDate: '2026-09-01' }), today)?.label).toBe('Lunas')
  })

  it('lewat jatuh tempo dan belum lunas → Terlambat N hari', () => {
    expect(poPaymentBadge('SELESAI', payable({ dueDate: '2026-10-01' }), today)?.label).toBe('Terlambat 9 hari')
    expect(poPaymentBadge('SELESAI', payable({ status: 'PARTIAL', dueDate: '2026-10-09' }), today)?.label).toBe('Terlambat 1 hari')
    expect(poPaymentBadge('SELESAI', payable({ dueDate: null }), today)?.label).toBe('Belum Bayar')
  })
})
