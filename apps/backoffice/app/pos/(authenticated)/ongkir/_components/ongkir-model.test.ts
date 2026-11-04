import { describe, expect, it } from 'vitest'
import type { DeliveryHistoryRow } from '@/lib/services/grooming-report-service'
import { filterOngkirRows, summarizeOngkir, toCashierRows } from './ongkir-model'

const base: DeliveryHistoryRow = {
  id: 1, trxNumber: 'TRX-1', transactionId: 10, branchId: 2, branchName: 'Toko Pusat', status: 'DIPROSES',
  createdAt: new Date('2026-11-04T03:00:00Z'), courierId: 5, courierName: 'Budi', kind: 'BARANG', ownerName: null,
  address: null, fee: 15000, netFee: 15000, isFreeShipping: false, freeValue: 0, bonus: 7500, isPaid: true,
}

describe('menu Ongkir kasir', () => {
  it('bonus pengantar tidak ikut ke layar kasir', () => {
    const [row] = toCashierRows([base])
    expect(row).not.toHaveProperty('bonus')
    expect(row).toMatchObject({ trxNumber: 'TRX-1', courierName: 'Budi', charged: 15000, cancelled: false })
  })

  it('ringkasan: ditagih, gratis, dan batal dipisah', () => {
    const rows = toCashierRows([
      base,
      { ...base, id: 2, isFreeShipping: true, netFee: 0, freeValue: 10000, bonus: 0 },
      { ...base, id: 3, status: 'DIBATALKAN', bonus: 0 },
    ])
    expect(summarizeOngkir(rows)).toEqual({ count: 2, chargedTotal: 15000, freeCount: 1, freeTotal: 10000, cancelledCount: 1 })
  })

  it('saring pengantar dan ditagih/gratis', () => {
    const rows = toCashierRows([base, { ...base, id: 2, courierId: 6, isFreeShipping: true, freeValue: 10000 }])
    expect(filterOngkirRows(rows, 5, 'ALL').map((r) => r.id)).toEqual([1])
    expect(filterOngkirRows(rows, null, 'FREE').map((r) => r.id)).toEqual([2])
    expect(filterOngkirRows(rows, null, 'CHARGED').map((r) => r.id)).toEqual([1])
  })
})
