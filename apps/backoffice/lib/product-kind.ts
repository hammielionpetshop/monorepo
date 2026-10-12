// Jenis produk (products.product_kind). Jasa tidak punya stok & modal — lihat
// docs/work/specs/2026-10-11-jasa-grooming-design.md.
export const PRODUCT_KINDS = ['BARANG', 'JASA_GROOMING', 'JASA_ONGKIR'] as const
export type ProductKind = (typeof PRODUCT_KINDS)[number]

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  BARANG: 'Barang (punya stok)',
  JASA_GROOMING: 'Jasa Grooming (tanpa stok)',
  JASA_ONGKIR: 'Jasa Ongkos Kirim (tanpa stok)',
}

export function isProductKind(value: unknown): value is ProductKind {
  return typeof value === 'string' && (PRODUCT_KINDS as readonly string[]).includes(value)
}

// Apa pun selain BARANG diperlakukan sebagai jasa, supaya jenis jasa baru (mis. penitipan)
// otomatis ikut terjaga dari mutasi stok sebelum kodenya dilengkapi.
export function isServiceKind(kind: string | null | undefined): boolean {
  return kind != null && kind !== 'BARANG'
}

export const SERVICE_STOCK_MESSAGE = 'Produk jasa tidak memiliki stok, jadi tidak bisa dipakai di dokumen stok'
