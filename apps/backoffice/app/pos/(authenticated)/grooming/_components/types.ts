import Big from 'big.js'
import type { CartItem } from '@/components/pos/cart-store'
import type { GroomingTicketData } from '@/lib/escpos-grooming-ticket'
import { formatPetAge } from '@/lib/pet-age'

export interface ServiceOption {
  productId: number
  name: string
  uomId: number
  uomCode: string
  tierPrices: Record<string, string>
}

export interface PersonOption {
  id: number
  name: string
}

export interface OwnerPet {
  id: number
  name: string
  species: string
  color: string
  birthDate: string | null
}

export interface Owner {
  id: number
  name: string
  phone: string | null
  address: string | null
  tierType: string
  pets: OwnerPet[]
}

/** Satu ekor kucing di daftar Terima Kucing. */
export interface IntakeLine {
  pet: OwnerPet
  service: ServiceOption
  groomer: PersonOption
  condition: string
}

export interface IntakeDelivery {
  courier: PersonOption
  address: string
  /** Besar ongkir lewat qty: qty × harga satuan ongkir (Rp 1.000). */
  qty: number
  /** Gratis antar-jemput: ongkir tercatat nilainya tetapi tidak ditagih; pengantar tanpa bonus. */
  free?: boolean
}

/** Bentuk baris daftar dari /api/pos/grooming/orders (tanggal sudah jadi string JSON). */
export interface GroomingOrder {
  id: number
  ticketNumber: string
  trxNumber: string
  transactionId: number
  status: 'DIKERJAKAN' | 'DIAMBIL' | 'DIBATALKAN'
  receivedAt: string
  pickedUpAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  condition: string
  serviceName: string
  price: number
  pet: OwnerPet
  owner: { id: number; name: string; phone: string | null }
  groomer: PersonOption
  debtRemaining: number
  isPaid: boolean
  ticketPrintCount: number
  delivery: { id: number; status: string; address: string; courier: PersonOption; fee: number } | null
}

const FALLBACK_TIER = 'RETAIL'

/**
 * Harga jasa untuk golongan pelanggan. Jasa yang tidak punya harga di golongan itu jatuh ke
 * RETAIL — aturan yang sama dengan barang di tab Kasir (produk tidak ditolak hanya karena harga
 * golongannya belum diisi).
 */
export function priceForTier(tierPrices: Record<string, string>, tier: string): { tier: string; price: string } | null {
  if (tierPrices[tier] != null) return { tier, price: tierPrices[tier] }
  if (tierPrices[FALLBACK_TIER] != null) return { tier: FALLBACK_TIER, price: tierPrices[FALLBACK_TIER] }
  const first = Object.entries(tierPrices)[0]
  return first ? { tier: first[0], price: first[1] } : null
}

/**
 * Susun baris nota dari daftar Terima Kucing: satu baris per ekor (qty selalu 1, tidak pernah
 * digabung) + satu baris ongkir bila delivery. Baris inilah yang dikirim layar bayar ke server.
 */
export function buildGroomingCartItems(
  lines: IntakeLine[],
  tier: string,
  delivery: IntakeDelivery | null,
  ongkir: ServiceOption | null,
): CartItem[] {
  const items: CartItem[] = lines.map((line) => {
    const priced = priceForTier(line.service.tierPrices, tier)
    if (!priced) throw new Error(`${line.service.name} belum punya harga di cabang ini`)
    return {
      productId: line.service.productId,
      productName: `${line.service.name} - ${line.pet.name}`,
      uomId: line.service.uomId,
      uomCode: line.service.uomCode,
      qty: 1,
      unitPrice: priced.price,
      priceTier: priced.tier,
      discountAmount: '0',
      subtotal: new Big(priced.price).round(0).toString(),
      tierPrices: line.service.tierPrices,
      grooming: { petId: line.pet.id, groomerId: line.groomer.id, condition: line.condition.trim() },
    }
  })
  if (delivery) {
    if (!ongkir) throw new Error('Produk ongkos kirim belum tersedia di cabang ini')
    const priced = priceForTier(ongkir.tierPrices, tier)
    if (!priced) throw new Error('Ongkos kirim belum punya harga di cabang ini')
    const gross = new Big(priced.price).times(delivery.qty).round(0).toString()
    items.push({
      productId: ongkir.productId,
      productName: delivery.free ? 'Ongkos kirim (antar-jemput) — GRATIS' : 'Ongkos kirim (antar-jemput)',
      uomId: ongkir.uomId,
      uomCode: ongkir.uomCode,
      qty: delivery.qty,
      unitPrice: priced.price,
      priceTier: priced.tier,
      discountAmount: delivery.free ? gross : '0',
      subtotal: delivery.free ? '0' : gross,
      tierPrices: ongkir.tierPrices,
      productKind: 'JASA_ONGKIR',
      delivery: { courierId: delivery.courier.id, address: delivery.address.trim(), ...(delivery.free ? { freeShipping: true } : {}) },
    })
  }
  return items
}

export function cartTotal(items: CartItem[]): string {
  return items.reduce((sum, item) => sum.plus(item.subtotal), new Big(0)).round(0).toString()
}

export function toTicketData(order: GroomingOrder, storeName: string, isReprint: boolean): GroomingTicketData {
  return {
    storeName,
    ticketNumber: order.ticketNumber,
    ownerName: order.owner.name,
    ownerPhone: order.owner.phone,
    petName: order.pet.name,
    petSpecies: order.pet.species,
    petColor: order.pet.color,
    petAge: formatPetAge(order.pet.birthDate),
    serviceName: order.serviceName,
    groomerName: order.groomer.name,
    condition: order.condition,
    receivedAt: order.receivedAt,
    isPaid: order.isPaid,
    delivery: order.delivery ? { courierName: order.delivery.courier.name, address: order.delivery.address } : null,
    isReprint,
  }
}

export function formatRp(value: number | string): string {
  return `Rp ${Number(value).toLocaleString('id-ID')}`
}

export function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
