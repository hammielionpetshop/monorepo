import { describe, expect, it } from 'vitest'
import { matchesSearchWords, splitSearchWords } from './search-words'

describe('splitSearchWords', () => {
  it('memecah per spasi, huruf kecil, buang kosong', () => {
    expect(splitSearchWords('  Bolt   IKAN ')).toEqual(['bolt', 'ikan'])
    expect(splitSearchWords('   ')).toEqual([])
  })
})

describe('matchesSearchWords', () => {
  const fields = ['BOLT DRY IKAN 800GR', 'SKU-10021', '8991234567890']

  it('kata tidak harus berurutan atau berdempetan', () => {
    expect(matchesSearchWords('bolt ikan', fields)).toBe(true)
    expect(matchesSearchWords('ikan bolt', fields)).toBe(true)
    expect(matchesSearchWords('bol ik 800', fields)).toBe(true)
  })

  it('semua kata harus ada', () => {
    expect(matchesSearchWords('bolt salmon', fields)).toBe(false)
  })

  it('kata boleh cocok di kolom berbeda (nama, SKU, barcode)', () => {
    expect(matchesSearchWords('bolt 10021', fields)).toBe(true)
    expect(matchesSearchWords('8991234567890', fields)).toBe(true)
  })

  it('pencarian kosong cocok dengan semua, kolom kosong aman', () => {
    expect(matchesSearchWords('', fields)).toBe(true)
    expect(matchesSearchWords('bolt', [null, undefined, 'Bolt'])).toBe(true)
    expect(matchesSearchWords('bolt', [null, undefined])).toBe(false)
  })
})
