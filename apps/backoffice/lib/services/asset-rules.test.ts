import { describe, expect, it } from 'vitest'
import {
  accumulatedThrough, bookValueAt, checkDisposal, checkPurchase, depreciationFor, depreciationSchedule, disposalResult, monthlyPortion,
  type DepreciationAsset,
} from './asset-rules'

const freezer: DepreciationAsset = {
  purchasePrice: 7_500_000, usefulLifeMonths: 48, purchasedOn: '2026-11-10', status: 'IN_USE', disposedOn: null, saleAmount: null,
}

describe('penyusutan garis lurus', () => {
  it('membagi rata mulai bulan beli', () => {
    expect(depreciationFor(freezer, '2026-11')).toBe(156_250)
    expect(depreciationFor(freezer, '2030-10')).toBe(156_250)
    expect(depreciationFor(freezer, '2030-11')).toBe(0)
    expect(depreciationFor(freezer, '2026-10')).toBe(0)
  })

  it('sisa pembulatan di bulan terakhir', () => {
    expect(monthlyPortion(1_000_000, 3, 1)).toBe(333_333)
    expect(monthlyPortion(1_000_000, 3, 3)).toBe(333_334)
    const a = { ...freezer, purchasePrice: 1_000_000, usefulLifeMonths: 3 }
    expect(depreciationSchedule(a).map((r) => r.portion)).toEqual([333_333, 333_333, 333_334])
    expect(bookValueAt(a, '2027-01')).toBe(0)
    expect(bookValueAt(a, '2030-01')).toBe(0)
  })

  it('sisa nilai per bulan', () => {
    expect(bookValueAt(freezer, '2026-11')).toBe(7_343_750)
    expect(accumulatedThrough(freezer, '2028-02')).toBe(2_500_000)
  })
})

describe('pelepasan aset', () => {
  it('dijual di tengah umur: kerugian = sisa nilai bulan sebelumnya − uang jual (contoh spec)', () => {
    const sold = { ...freezer, status: 'SOLD' as const, disposedOn: '2028-03-05', saleAmount: 3_000_000 }
    expect(disposalResult(sold)).toEqual({ month: '2028-03', loss: 2_000_000 })
    expect(depreciationFor(sold, '2028-02')).toBe(156_250)
    expect(depreciationFor(sold, '2028-03')).toBe(0)
    expect(bookValueAt(sold, '2028-03')).toBe(0)
  })

  it('rusak di bulan beli: seluruh harga jadi kerugian, tanpa penyusutan', () => {
    const broken = { ...freezer, status: 'DAMAGED' as const, disposedOn: '2026-11-20' }
    expect(disposalResult(broken)).toEqual({ month: '2026-11', loss: 7_500_000 })
    expect(depreciationFor(broken, '2026-11')).toBe(0)
    expect(depreciationSchedule(broken)).toEqual([])
  })

  it('dijual sesudah umur habis: uang jual menjadi untung', () => {
    const a = { ...freezer, purchasePrice: 1_200_000, usefulLifeMonths: 2, status: 'SOLD' as const, disposedOn: '2027-06-01', saleAmount: 300_000 }
    expect(disposalResult(a)).toEqual({ month: '2027-06', loss: -300_000 })
  })

  it('aset masih dipakai tidak punya hasil pelepasan', () => {
    expect(disposalResult(freezer)).toBeNull()
  })
})

describe('pemeriksaan isian', () => {
  const base = { name: 'Freezer', assetType: 'MACHINE', usefulLifeMonths: 48, purchasePrice: 7_500_000, purchasedOn: '2026-11-10', today: '2026-11-12' }
  it('menerima isian sah', () => expect(checkPurchase(base)).toBeNull())
  it('menolak di bawah Rp1 juta', () => expect(checkPurchase({ ...base, purchasePrice: 900_000 })).toMatch(/minimal/))
  it('menolak sebelum 1 Nov 2026', () => expect(checkPurchase({ ...base, purchasedOn: '2026-10-31' })).toMatch(/1 November/))
  it('menolak tanggal masa depan', () => expect(checkPurchase({ ...base, purchasedOn: '2026-11-13' })).toMatch(/hari ini/))
  it('menolak umur di luar 1–120', () => expect(checkPurchase({ ...base, usefulLifeMonths: 0 })).toMatch(/Umur/))

  const d = { current: 'IN_USE' as const, isCancelled: false, next: 'SOLD', disposedOn: '2026-11-12', purchasedOn: '2026-11-10', today: '2026-11-12', reason: 'laku ke toko lain', saleAmount: 1_000 }
  it('menerima jual sah', () => expect(checkDisposal(d)).toBeNull())
  it('menolak keadaan yang sudah dilepas', () => expect(checkDisposal({ ...d, current: 'LOST' })).toMatch(/tidak bisa diubah/))
  it('jual wajib uang jual', () => expect(checkDisposal({ ...d, saleAmount: null })).toMatch(/Uang hasil jual/))
  it('rusak tanpa uang jual', () => expect(checkDisposal({ ...d, next: 'DAMAGED', saleAmount: 5 })).toMatch(/hanya untuk/))
  it('tanggal sebelum beli ditolak', () => expect(checkDisposal({ ...d, disposedOn: '2026-11-09' })).toMatch(/sebelum tanggal beli/))
})
