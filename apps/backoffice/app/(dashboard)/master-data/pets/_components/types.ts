export interface Pet {
  id: number
  name: string
  species: string
  color: string
  birthDate: string | null
  isActive: boolean
  customerId: number
  ownerName: string
  ownerPhone: string | null
}

export interface OwnerOption {
  id: number
  name: string
  phone: string | null
  pets: { id: number; name: string }[]
}

/** Saring daftar kucing dari kotak cari: nama kucing, nama pemilik, atau angka nomor telepon. */
export function filterPets(pets: Pet[], search: string): Pet[] {
  const q = search.trim().toLowerCase()
  if (!q) return pets
  const digits = q.replace(/\D/g, '')
  return pets.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.ownerName.toLowerCase().includes(q) ||
      (digits.length >= 3 && (p.ownerPhone ?? '').replace(/\D/g, '').includes(digits)),
  )
}
