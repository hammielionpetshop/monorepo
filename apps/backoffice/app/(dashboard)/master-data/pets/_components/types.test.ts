import { describe, expect, it } from 'vitest'
import { filterPets, type Pet } from './types'

const pet = (over: Partial<Pet>): Pet => ({
  id: 1, name: 'Mochi', species: 'Persia', color: 'putih', birthDate: null, isActive: true,
  customerId: 10, ownerName: 'Ibu Rina', ownerPhone: '0812-3456-789', ...over,
})

describe('filterPets', () => {
  const pets = [pet({}), pet({ id: 2, name: 'Oyen', ownerName: 'Pak Budi', ownerPhone: null })]

  it('kosong = semua', () => expect(filterPets(pets, '  ')).toHaveLength(2))
  it('nama kucing', () => expect(filterPets(pets, 'oye').map((p) => p.id)).toEqual([2]))
  it('nama pemilik', () => expect(filterPets(pets, 'RINA').map((p) => p.id)).toEqual([1]))
  it('nomor HP tanpa peduli tanda baca', () => expect(filterPets(pets, '0812 3456').map((p) => p.id)).toEqual([1]))
  it('angka terlalu pendek tidak dicocokkan ke nomor', () => expect(filterPets(pets, '08')).toHaveLength(0))
})
