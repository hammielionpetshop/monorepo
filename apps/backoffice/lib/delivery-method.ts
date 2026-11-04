// Cara kirim nota & PO Internal (Logistik Tahap 1 bagian kasir). Satu-satunya tempat aturannya;
// dipakai layar bayar POS, Bulk Sale, sinkron offline, Kirim PO Internal, dan Ubah cara kirim.
// Spec: docs/work/specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md §3.1, §3.2.

export const SALE_DELIVERY_METHODS = ['PICKUP', 'BRANCH_COURIER', 'TRUCK'] as const
export type SaleDeliveryMethod = (typeof SALE_DELIVERY_METHODS)[number]

export const TRANSFER_DELIVERY_METHODS = ['TRUCK', 'SELF'] as const
export type TransferDeliveryMethod = (typeof TRANSFER_DELIVERY_METHODS)[number]

export const SALE_DELIVERY_LABELS: Record<SaleDeliveryMethod, string> = {
  PICKUP: 'Ambil sendiri',
  BRANCH_COURIER: 'Diantar kurir cabang',
  TRUCK: 'Dikirim truk Gudang',
}

export const TRANSFER_DELIVERY_LABELS: Record<TransferDeliveryMethod, string> = {
  TRUCK: 'Truk Gudang',
  SELF: 'Kirim sendiri',
}

// Kasir & cabang asal boleh mengubah cara kirim sampai sekian hari sesudah nota; sesudahnya Owner/GM.
export const DELIVERY_CHANGE_DAYS = 7
export const DELIVERY_REASON_MAX = 300

export const REQUIRED_SETTING_KEY = 'delivery_method_required'
export const TRUCK_FIRST_SETTING_KEY = 'delivery_truck_first_branch_ids'

// Petunjuk satu-satunya untuk "Diantar kurir cabang": selalu lewat baris Ongkos Kirim supaya pengantar
// (dan bonusnya) tercatat. Antar tanpa ongkos = centang Gratis ongkir (tercatat, tidak ditagih, tanpa bonus).
export const COURIER_NEEDS_ONGKIR_MESSAGE =
  'Diantar kurir cabang harus lewat Ongkos Kirim: tambahkan produk Ongkos Kirim ke keranjang, lalu pilih pengantarnya. Tidak ditagih? Centang "Gratis ongkir".'

export class DeliveryMethodError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
    this.name = 'DeliveryMethodError'
  }
}

export function isSaleDeliveryMethod(value: unknown): value is SaleDeliveryMethod {
  return typeof value === 'string' && (SALE_DELIVERY_METHODS as readonly string[]).includes(value)
}

export function isTransferDeliveryMethod(value: unknown): value is TransferDeliveryMethod {
  return typeof value === 'string' && (TRANSFER_DELIVERY_METHODS as readonly string[]).includes(value)
}

export function saleDeliveryLabel(value: string | null | undefined): string | null {
  return isSaleDeliveryMethod(value) ? SALE_DELIVERY_LABELS[value] : null
}

export function transferDeliveryLabel(value: string | null | undefined): string | null {
  return isTransferDeliveryMethod(value) ? TRANSFER_DELIVERY_LABELS[value] : null
}

/** Nilai pengaturan dari app_settings. Baris hilang = wajib pilih menyala (bawaan). */
export function parseDeliverySettings(required: string | null, truckFirst: string | null) {
  return {
    required: required !== 'false',
    truckFirstBranchIds: (truckFirst ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
  }
}

/** Urutan tombol di layar bayar: cabang "truk sering" menaruh Truk Gudang paling depan. */
export function saleDeliveryOrder(truckFirst: boolean): SaleDeliveryMethod[] {
  return truckFirst ? ['TRUCK', 'PICKUP', 'BRANCH_COURIER'] : ['PICKUP', 'BRANCH_COURIER', 'TRUCK']
}

/** Apakah layar bayar perlu menanyakan cara kirim untuk nota ini. */
export function needsDeliveryChoice(input: { customerId: number | null | undefined; sourceIbtId?: number | null }): boolean {
  return input.customerId != null && input.customerId > 0 && input.sourceIbtId == null
}

/**
 * Cara kirim yang disimpan untuk satu nota.
 * - Nota Umum (tanpa pelanggan) dan nota hasil PO Internal: selalu kosong (pilihannya di PO Internal).
 * - Nota berisi baris ongkir + pengantar: selalu kurir cabang.
 * - Kurir cabang TANPA baris ongkir ditolak (pengantar tidak tercatat); Bulk Sale tidak punya baris
 *   ongkir, jadi kurir cabang tidak tersedia di sana.
 * - Selain itu: pilihan kasir; kosong ditolak bila `required` (saklar wajib pilih menyala).
 */
export function resolveSaleDeliveryMethod(input: {
  customerId: number | null | undefined
  sourceIbtId?: number | null
  hasCourierLine: boolean
  requested?: string | null
  required: boolean
}): SaleDeliveryMethod | null {
  if (!needsDeliveryChoice(input)) return null
  const requested = input.requested ?? null
  if (requested != null && !isSaleDeliveryMethod(requested)) {
    throw new DeliveryMethodError('Cara kirim tidak dikenal')
  }
  if (input.hasCourierLine) {
    if (requested != null && requested !== 'BRANCH_COURIER') {
      throw new DeliveryMethodError('Nota ini berisi ongkos kirim, jadi cara kirimnya "Diantar kurir cabang".')
    }
    return 'BRANCH_COURIER'
  }
  if (requested === 'BRANCH_COURIER') throw new DeliveryMethodError(COURIER_NEEDS_ONGKIR_MESSAGE)
  if (requested != null) return requested
  if (input.required) {
    throw new DeliveryMethodError('Pilih cara kirim dulu: Ambil sendiri, Diantar kurir cabang, atau Dikirim truk Gudang.')
  }
  return null
}

/** PO Internal saat Kirim: wajib bila saklar menyala. */
export function resolveTransferDeliveryMethod(requested: string | null | undefined, required: boolean): TransferDeliveryMethod | null {
  if (requested != null) {
    if (!isTransferDeliveryMethod(requested)) throw new DeliveryMethodError('Cara kirim PO Internal tidak dikenal')
    return requested
  }
  if (required) throw new DeliveryMethodError('Pilih cara kirim PO Internal dulu: Truk Gudang atau Kirim sendiri.')
  return null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Siapa boleh mengubah cara kirim (jalan keluar salah tandai). Mengembalikan pesan penolakan, atau
 * null bila boleh. Owner/GM kapan saja; selain itu hanya cabang asal dan paling lama
 * DELIVERY_CHANGE_DAYS hari sejak dokumen dibuat.
 */
export function deliveryChangeProblem(input: {
  isPrivileged: boolean
  sameBranch: boolean
  createdAt: Date
  now: Date
  oldMethod: string | null
  newMethod: string
  reason: string
}): string | null {
  if (input.oldMethod === input.newMethod) return 'Cara kirimnya sudah itu.'
  if (!input.reason.trim()) return 'Alasan wajib diisi.'
  if (input.reason.trim().length > DELIVERY_REASON_MAX) return `Alasan paling panjang ${DELIVERY_REASON_MAX} huruf.`
  if (input.isPrivileged) return null
  if (!input.sameBranch) return 'Hanya cabang asal nota yang boleh mengubah cara kirimnya.'
  if (input.now.getTime() - input.createdAt.getTime() > DELIVERY_CHANGE_DAYS * DAY_MS) {
    return `Sudah lewat ${DELIVERY_CHANGE_DAYS} hari. Minta Pemilik atau GM untuk mengubahnya.`
  }
  return null
}
