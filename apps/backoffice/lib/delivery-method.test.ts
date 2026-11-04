import { describe, expect, it } from 'vitest'
import {
  DeliveryMethodError,
  deliveryChangeProblem,
  parseDeliverySettings,
  resolveSaleDeliveryMethod,
  resolveTransferDeliveryMethod,
  saleDeliveryOrder,
} from './delivery-method'

describe('resolveSaleDeliveryMethod', () => {
  const base = { customerId: 5, sourceIbtId: null, hasCourierLine: false, required: true }

  it('nota Umum tidak ditanya dan selalu kosong', () => {
    expect(resolveSaleDeliveryMethod({ ...base, customerId: null })).toBeNull()
    expect(resolveSaleDeliveryMethod({ ...base, customerId: null, requested: 'TRUCK' })).toBeNull()
  })

  it('nota PO Internal kosong (pilihannya di PO Internal)', () => {
    expect(resolveSaleDeliveryMethod({ ...base, sourceIbtId: 9, requested: 'TRUCK' })).toBeNull()
  })

  it('nota berpelanggan tanpa pilihan ditolak bila wajib', () => {
    expect(() => resolveSaleDeliveryMethod(base)).toThrow(DeliveryMethodError)
  })

  it('saklar mati: tanpa pilihan diterima kosong', () => {
    expect(resolveSaleDeliveryMethod({ ...base, required: false })).toBeNull()
  })

  it('pilihan kasir disimpan', () => {
    expect(resolveSaleDeliveryMethod({ ...base, requested: 'TRUCK' })).toBe('TRUCK')
    expect(resolveSaleDeliveryMethod({ ...base, requested: 'PICKUP' })).toBe('PICKUP')
  })

  it('kurir cabang tanpa baris ongkir ditolak (juga saat saklar mati)', () => {
    expect(() => resolveSaleDeliveryMethod({ ...base, requested: 'BRANCH_COURIER' })).toThrow(/ongkos kirim/i)
    expect(() => resolveSaleDeliveryMethod({ ...base, required: false, requested: 'BRANCH_COURIER' })).toThrow(/ongkos kirim/i)
  })

  it('nota berongkir selalu kurir cabang, pilihan lain ditolak', () => {
    expect(resolveSaleDeliveryMethod({ ...base, hasCourierLine: true })).toBe('BRANCH_COURIER')
    expect(() => resolveSaleDeliveryMethod({ ...base, hasCourierLine: true, requested: 'TRUCK' })).toThrow(DeliveryMethodError)
  })

  it('kasir POS (everyNota): nota Umum juga ditanya', () => {
    const umum = { ...base, customerId: null, everyNota: true }
    expect(() => resolveSaleDeliveryMethod(umum)).toThrow(DeliveryMethodError)
    expect(resolveSaleDeliveryMethod({ ...umum, requested: 'PICKUP' })).toBe('PICKUP')
    expect(resolveSaleDeliveryMethod({ ...umum, hasCourierLine: true })).toBe('BRANCH_COURIER')
  })

  it('truk Gudang wajib berpelanggan', () => {
    expect(() => resolveSaleDeliveryMethod({ ...base, customerId: null, everyNota: true, requested: 'TRUCK' })).toThrow(/berpelanggan/)
  })

  it('nota grooming tanpa antar otomatis ambil sendiri', () => {
    expect(resolveSaleDeliveryMethod({ ...base, hasGrooming: true })).toBe('PICKUP')
    expect(resolveSaleDeliveryMethod({ ...base, hasGrooming: true, hasCourierLine: true })).toBe('BRANCH_COURIER')
    expect(resolveSaleDeliveryMethod({ ...base, hasGrooming: true, required: false })).toBeNull()
  })

  it('nilai asing ditolak', () => {
    expect(() => resolveSaleDeliveryMethod({ ...base, requested: 'DRONE' })).toThrow(DeliveryMethodError)
  })
})

describe('resolveTransferDeliveryMethod', () => {
  it('wajib saat saklar menyala, bebas saat mati', () => {
    expect(() => resolveTransferDeliveryMethod(null, true)).toThrow(DeliveryMethodError)
    expect(resolveTransferDeliveryMethod(null, false)).toBeNull()
    expect(resolveTransferDeliveryMethod('SELF', true)).toBe('SELF')
    expect(() => resolveTransferDeliveryMethod('PICKUP', true)).toThrow(DeliveryMethodError)
  })
})

describe('deliveryChangeProblem', () => {
  const created = new Date('2026-11-01T03:00:00Z')
  const base = {
    isPrivileged: false,
    sameBranch: true,
    createdAt: created,
    now: new Date('2026-11-04T03:00:00Z'),
    oldMethod: 'TRUCK',
    newMethod: 'PICKUP',
    reason: 'Toko ambil sendiri',
  }

  it('cabang asal dalam 7 hari boleh', () => {
    expect(deliveryChangeProblem(base)).toBeNull()
  })

  it('alasan wajib', () => {
    expect(deliveryChangeProblem({ ...base, reason: '  ' })).toMatch(/Alasan/)
  })

  it('cabang lain ditolak, Owner/GM boleh', () => {
    expect(deliveryChangeProblem({ ...base, sameBranch: false })).toMatch(/cabang asal/)
    expect(deliveryChangeProblem({ ...base, sameBranch: false, isPrivileged: true })).toBeNull()
  })

  it('lewat 7 hari hanya Owner/GM', () => {
    const late = { ...base, now: new Date('2026-11-08T03:00:01Z') }
    expect(deliveryChangeProblem(late)).toMatch(/7 hari/)
    expect(deliveryChangeProblem({ ...late, isPrivileged: true })).toBeNull()
  })

  it('tidak berubah ditolak', () => {
    expect(deliveryChangeProblem({ ...base, newMethod: 'TRUCK' })).toMatch(/sudah itu/)
  })
})

describe('pengaturan', () => {
  it('baris hilang = wajib menyala', () => {
    expect(parseDeliverySettings(null, null)).toEqual({ required: true, truckFirstBranchIds: [] })
    expect(parseDeliverySettings('false', '3, 7,x,')).toEqual({ required: false, truckFirstBranchIds: [3, 7] })
  })

  it('truk paling depan di cabang Gudang', () => {
    expect(saleDeliveryOrder(true)[0]).toBe('TRUCK')
    expect(saleDeliveryOrder(false)[0]).toBe('PICKUP')
  })
})
