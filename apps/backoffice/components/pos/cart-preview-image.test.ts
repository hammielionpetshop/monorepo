import { describe, it, expect } from 'vitest'
import { wrapLines } from './cart-preview-image'

// Pengukur palsu: tiap huruf selebar 10px, jadi lebarnya bisa dihitung di kepala.
const measure = (s: string) => s.length * 10

describe('wrapLines', () => {
  it('membiarkan teks yang muat jadi satu baris', () => {
    expect(wrapLines('JAGUNG TT', 200, measure)).toEqual(['JAGUNG TT'])
  })

  it('memenggal di spasi saat teksnya kelewat panjang', () => {
    expect(wrapLines('TROPICAL FISH FOOD 100GR', 120, measure)).toEqual([
      'TROPICAL',
      'FISH FOOD',
      '100GR',
    ])
  })

  it('memotong per huruf kata tunggal yang lebih lebar dari satu baris', () => {
    expect(wrapLines('AAAAAAAAAA', 50, measure)).toEqual(['AAAAA', 'AAAAA'])
  })

  it('memindahkan kata kelewat lebar ke baris baru sebelum dipotong', () => {
    expect(wrapLines('PW AAAAAAAA', 50, measure)).toEqual(['PW', 'AAAAA', 'AAA'])
  })

  it('mengembalikan satu baris kosong untuk teks kosong', () => {
    expect(wrapLines('', 100, measure)).toEqual([''])
    expect(wrapLines('   ', 100, measure)).toEqual([''])
  })
})
