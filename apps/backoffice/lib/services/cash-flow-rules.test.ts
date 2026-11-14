import { describe, expect, it } from 'vitest'
import { checkCancel, checkCategoryChange, checkEntry, checkTransfer, type EntryRuleInput } from './cash-flow-rules'

const base: EntryRuleInput = {
  type: 'EXPENSE',
  occurredOn: '2026-11-09',
  forMonth: '2026-10',
  note: null,
  category: { type: 'EXPENSE', isActive: true, isSystem: false, ownerOnly: false, noteRequired: false },
  place: { kind: 'BANK', isActive: true },
  isOwner: false,
  today: '2026-11-09',
}

describe('checkEntry (F2-4b)', () => {
  it('menerima catatan listrik Oktober dibayar hari ini dari rekening', () => {
    expect(checkEntry(base)).toBeNull()
  })

  it('batas tanggal: masa depan ditolak, 7 hari boleh, 8 hari hanya Owner', () => {
    expect(checkEntry({ ...base, occurredOn: '2026-11-10' })).toMatch(/melewati hari ini/)
    expect(checkEntry({ ...base, occurredOn: '2026-11-02' })).toBeNull()
    expect(checkEntry({ ...base, occurredOn: '2026-11-01' })).toMatch(/hanya Owner/)
    expect(checkEntry({ ...base, occurredOn: '2026-11-01', isOwner: true })).toBeNull()
    expect(checkEntry({ ...base, occurredOn: '2026-02-31' })).toMatch(/tidak valid/)
  })

  it('untuk bulan paling jauh 12 bulan dari bulan tanggal uang', () => {
    expect(checkEntry({ ...base, forMonth: '2025-11' })).toBeNull()
    expect(checkEntry({ ...base, forMonth: '2025-10' })).toMatch(/12 bulan/)
    expect(checkEntry({ ...base, forMonth: '2027-11' })).toBeNull()
    expect(checkEntry({ ...base, forMonth: '2026-13' })).toMatch(/tidak valid/)
  })

  it('kategori: sistem, nonaktif, tipe beda, hanya Owner, catatan wajib', () => {
    const cat = base.category!
    expect(checkEntry({ ...base, category: { ...cat, isSystem: true } })).toMatch(/otomatis/)
    expect(checkEntry({ ...base, category: { ...cat, isActive: false } })).toMatch(/nonaktif/)
    expect(checkEntry({ ...base, category: { ...cat, type: 'INCOME' } })).toMatch(/tidak sesuai/)
    expect(checkEntry({ ...base, category: { ...cat, ownerOnly: true } })).toMatch(/hanya boleh dicatat Owner/)
    expect(checkEntry({ ...base, category: { ...cat, ownerOnly: true }, isOwner: true })).toBeNull()
    expect(checkEntry({ ...base, category: { ...cat, noteRequired: true }, note: '  ' })).toMatch(/Catatan wajib/)
    expect(checkEntry({ ...base, category: null })).toMatch(/tidak ditemukan/)
  })

  it('Tempat Uang wajib, bukan laci, aktif', () => {
    expect(checkEntry({ ...base, place: null })).toMatch(/Dibayar dari/)
    expect(checkEntry({ ...base, type: 'INCOME', category: { ...base.category!, type: 'INCOME' }, place: null })).toMatch(/Masuk ke/)
    expect(checkEntry({ ...base, place: { kind: 'DRAWER', isActive: true } })).toMatch(/Laci/)
    expect(checkEntry({ ...base, place: { kind: 'CASH', isActive: false } })).toMatch(/nonaktif/)
    expect(checkEntry({ ...base, place: { kind: 'CASH', isActive: true } })).toBeNull()
  })
})

describe('checkCancel (F2-4b)', () => {
  const c = { isCancelled: false, isSystemCategory: false, createdBy: 5, createdOn: '2026-11-09', actorId: 5, actorCanCancelAny: false, today: '2026-11-09' }
  it('pencatat sendiri di hari yang sama boleh; besok ditolak', () => {
    expect(checkCancel(c)).toBeNull()
    expect(checkCancel({ ...c, today: '2026-11-10' })).toMatch(/hari yang sama/)
  })
  it('orang lain ditolak kecuali Owner/GM', () => {
    expect(checkCancel({ ...c, actorId: 6 })).toMatch(/Owner\/GM/)
    expect(checkCancel({ ...c, actorId: 6, actorCanCancelAny: true, today: '2026-12-01' })).toBeNull()
  })
  it('sudah batal & catatan otomatis ditolak', () => {
    expect(checkCancel({ ...c, isCancelled: true, actorCanCancelAny: true })).toMatch(/sudah dibatalkan/)
    expect(checkCancel({ ...c, isSystemCategory: true, actorCanCancelAny: true })).toMatch(/otomatis/)
  })
})

describe('checkCategoryChange (F2-4b)', () => {
  const cur = { type: 'EXPENSE', reportKind: 'COST', isSystem: false }
  it('belum dipakai: bebas', () => {
    expect(checkCategoryChange({ current: cur, next: { type: 'INCOME', reportKind: 'INCOME' }, usedCount: 0 })).toBeNull()
  })
  it('sudah dipakai: tipe & jenis terkunci, kecuali jenis yang masih kosong', () => {
    expect(checkCategoryChange({ current: cur, next: { type: 'INCOME', reportKind: 'INCOME' }, usedCount: 3 })).toMatch(/Tipe/)
    expect(checkCategoryChange({ current: cur, next: { type: 'EXPENSE', reportKind: 'NON_COST' }, usedCount: 3 })).toMatch(/Jenis laporan/)
    expect(checkCategoryChange({ current: { ...cur, reportKind: null }, next: { type: 'EXPENSE', reportKind: 'NON_COST' }, usedCount: 3 })).toBeNull()
    expect(checkCategoryChange({ current: cur, next: { type: 'EXPENSE', reportKind: 'COST' }, usedCount: 3 })).toBeNull()
  })
  it('jenis harus cocok dengan tipe; kategori sistem terkunci', () => {
    expect(checkCategoryChange({ current: cur, next: { type: 'EXPENSE', reportKind: 'INCOME' }, usedCount: 0 })).toMatch(/tidak cocok/)
    expect(checkCategoryChange({ current: { ...cur, isSystem: true }, next: { type: 'EXPENSE', reportKind: 'NON_COST' }, usedCount: 0 })).toMatch(/sistem/)
  })
})

describe('checkTransfer (F2-4c)', () => {
  const brankas = { id: 1, kind: 'CASH', isActive: true }
  const bank = { id: 2, kind: 'BANK', isActive: true }
  const t = { from: brankas, to: bank, occurredOn: '2026-11-09', isOwner: false, today: '2026-11-09' }
  it('Brankas → rekening sah', () => {
    expect(checkTransfer(t)).toBeNull()
  })
  it('menolak sama, laci, nonaktif, kosong, dan tanggal di luar batas', () => {
    expect(checkTransfer({ ...t, to: brankas })).toMatch(/tidak boleh sama/)
    expect(checkTransfer({ ...t, from: { id: 3, kind: 'DRAWER', isActive: true } })).toMatch(/Laci/)
    expect(checkTransfer({ ...t, to: { ...bank, isActive: false } })).toMatch(/nonaktif/)
    expect(checkTransfer({ ...t, from: null })).toMatch(/asal/)
    expect(checkTransfer({ ...t, occurredOn: '2026-11-10' })).toMatch(/melewati/)
    expect(checkTransfer({ ...t, occurredOn: '2026-10-30' })).toMatch(/hanya Owner/)
    expect(checkTransfer({ ...t, occurredOn: '2026-10-30', isOwner: true })).toBeNull()
  })
})

describe('checkEntry Koreksi bulan lalu (F2-6f-3)', () => {
  const correction = { ...base, occurredOn: '2026-12-03', today: '2026-12-03', forMonth: '2026-11' }

  it('menerima koreksi beralasan untuk bulan sebelum tanggal uang', () => {
    expect(checkEntry({ ...correction, correctionReason: 'listrik November lupa dicatat' })).toBeNull()
  })

  it('menolak alasan kosong atau terlalu pendek', () => {
    expect(checkEntry({ ...correction, correctionReason: '' })).toMatch(/Alasan koreksi wajib/)
    expect(checkEntry({ ...correction, correctionReason: ' abc ' })).toMatch(/Alasan koreksi wajib/)
  })

  it('menolak bulan asal yang sama atau sesudah bulan tanggal uang', () => {
    expect(checkEntry({ ...correction, forMonth: '2026-12', correctionReason: 'salah catat bulan' })).toMatch(/bulan asal harus sebelum/)
  })

  it('catatan biasa tidak terpengaruh', () => {
    expect(checkEntry({ ...correction, correctionReason: null })).toBeNull()
  })
})
