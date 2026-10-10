import { describe, expect, it } from 'vitest'
import { poStage } from './po-stage'

describe('poStage', () => {
  it('memetakan status database ke tahap yang dilihat pengguna', () => {
    expect(poStage('PENDING_APPROVAL', 0)).toBe('RENCANA')
    expect(poStage('APPROVED', 0)).toBe('DISETUJUI')
    expect(poStage('IN_TRANSIT', 0)).toBe('DISETUJUI')
    expect(poStage('PARTIALLY_RECEIVED', 0)).toBe('DITERIMA')
    expect(poStage('FULLY_RECEIVED', 0)).toBe('DITERIMA')
    expect(poStage('REJECTED', 0)).toBe('DITOLAK')
    expect(poStage('CANCELLED', 0)).toBe('DIBATALKAN')
  })

  it('PO selesai dipisah menurut harga: ada yang belum berharga → Belum Ada Harga', () => {
    expect(poStage('COMPLETED', 0)).toBe('SELESAI')
    expect(poStage('COMPLETED', 2)).toBe('BELUM_HARGA')
  })
})
