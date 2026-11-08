import { describe, expect, it } from 'vitest'
import { checkCancel, checkCategoryChange, checkEntry, type EntryRuleInput } from './cash-flow-rules'

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
