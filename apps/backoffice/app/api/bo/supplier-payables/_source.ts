import { isNonCashMethod } from '@/lib/proof-photo'
import { db, moneyPlaces, paymentMethods, eq, sql } from '@/lib/db'

/**
 * F2-4a "Dibayar dari" (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §2):
 * pembayaran supplier yang memakai uang wajib menyebut Tempat Uang asalnya.
 * Tunai → tempat jenis Tunai; non-tunai (transfer, cek, dst.) → Rekening. Laci kasir tidak boleh.
 */

export type SourceKind = 'DRAWER' | 'CASH' | 'BANK'

export interface SourcePlace {
  id: number
  kind: SourceKind
  isActive: boolean
}

export class PaymentSourceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentSourceError'
  }
}

/** Jenis Tempat Uang yang cocok untuk cara bayar ini. */
export function requiredSourceKind(method: { name: string; type?: string | null }): 'CASH' | 'BANK' {
  return isNonCashMethod(method) ? 'BANK' : 'CASH'
}

/** Aturan murni: kembalikan pesan galat, atau null bila tempat uang sah untuk cara bayar itu. */
export function checkPaymentSource(
  method: { name: string; type?: string | null },
  place: SourcePlace | null,
): string | null {
  if (!place) return 'Pilih "Dibayar dari" (Tempat Uang asal pembayaran)'
  if (place.kind === 'DRAWER') return 'Laci kasir tidak bisa dipakai membayar supplier'
  if (!place.isActive) return 'Tempat Uang sudah nonaktif'
  const needed = requiredSourceKind(method)
  if (place.kind !== needed) {
    return needed === 'CASH'
      ? 'Pembayaran tunai harus dari Tempat Uang jenis Tunai'
      : 'Pembayaran non-tunai harus dari Rekening'
  }
  return null
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Baca cara bayar & Tempat Uang lalu periksa; melempar PaymentSourceError bila tidak sah. */
export async function assertPaymentSource(tx: Tx, methodName: string, moneyPlaceId: number | undefined): Promise<number> {
  const [method] = await tx
    .select({ name: paymentMethods.name, type: paymentMethods.type })
    .from(paymentMethods)
    .where(sql`upper(${paymentMethods.name}) = upper(${methodName})`)
    .limit(1)
  const place = moneyPlaceId
    ? (await tx
        .select({ id: moneyPlaces.id, kind: moneyPlaces.kind, isActive: moneyPlaces.isActive })
        .from(moneyPlaces)
        .where(eq(moneyPlaces.id, moneyPlaceId))
        .limit(1))[0]
    : undefined
  if (moneyPlaceId && !place) throw new PaymentSourceError('Tempat Uang tidak ditemukan')
  const error = checkPaymentSource(method ?? { name: methodName }, place ? { ...place, kind: place.kind as SourceKind } : null)
  if (error) throw new PaymentSourceError(error)
  return place!.id
}
