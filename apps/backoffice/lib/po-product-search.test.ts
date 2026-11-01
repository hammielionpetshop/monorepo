import { describe, expect, it } from 'vitest'

import { matchingProductNames, summarizeMatches } from './po-product-search'

const names = ['AMIGO TUNA 85GR', 'AMIGO SALMON', 'TUNA KALENG']

describe('matchingProductNames', () => {
  it('query kosong berarti tidak sedang mencari', () => {
    expect(matchingProductNames('  ', names)).toBeNull()
  })

  it('semua kata harus ada di satu nama produk, urutan bebas, huruf besar/kecil bebas', () => {
    expect(matchingProductNames('tuna amigo', names)).toEqual(['AMIGO TUNA 85GR'])
    expect(matchingProductNames('amigo', names)).toEqual(['AMIGO TUNA 85GR', 'AMIGO SALMON'])
  })

  it('kata yang tersebar di produk berbeda tidak dianggap cocok', () => {
    expect(matchingProductNames('salmon kaleng', names)).toEqual([])
  })
})

describe('summarizeMatches', () => {
  it('menyingkat bila produk cocok lebih dari batas', () => {
    expect(summarizeMatches(['A'])).toBe('A')
    expect(summarizeMatches(['A', 'B', 'C', 'D'])).toBe('A, B +2 lainnya')
  })
})
