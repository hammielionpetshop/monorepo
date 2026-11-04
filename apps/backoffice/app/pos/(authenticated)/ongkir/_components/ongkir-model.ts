import Big from 'big.js'
import type { DeliveryHistoryRow } from '@/lib/services/grooming-report-service'

// Menu Ongkir kasir POS: riwayat ongkir + pengantar cabang sendiri. Sumbernya sama dengan laporan
// Back Office (listDeliveryHistory), tetapi TANPA bonus pengantar (keputusan owner 2026-11-04: bonus
// hanya di laporan Pemilik/GM).

export interface CashierOngkirRow {
  id: number
  trxNumber: string
  createdAt: string
  courierId: number
  courierName: string
  /** GROOMING = antar-jemput kucing; BARANG = antar barang dari tab Kasir. */
  kind: 'GROOMING' | 'BARANG'
  customerName: string | null
  /** Ongkir yang ditagih (sesudah bagian diskon nota); 0 bila gratis. */
  charged: number
  isFreeShipping: boolean
  /** Nilai gratis ongkir yang ditanggung toko. */
  freeValue: number
  status: string
  cancelled: boolean
}

export interface OngkirSummary {
  count: number
  chargedTotal: number
  freeCount: number
  freeTotal: number
  cancelledCount: number
}

export const CANCELLED_STATUS = 'DIBATALKAN'

/** Baris untuk layar kasir — bonus sengaja tidak dibawa. */
export function toCashierRows(rows: DeliveryHistoryRow[]): CashierOngkirRow[] {
  return rows.map((r) => ({
    id: r.id,
    trxNumber: r.trxNumber,
    createdAt: r.createdAt.toISOString(),
    courierId: r.courierId,
    courierName: r.courierName,
    kind: r.kind,
    customerName: r.ownerName,
    charged: r.isFreeShipping ? 0 : r.netFee,
    isFreeShipping: r.isFreeShipping,
    freeValue: r.freeValue,
    status: r.status,
    cancelled: r.status === CANCELLED_STATUS,
  }))
}

/** Ringkasan; yang dibatalkan hanya dihitung jumlahnya. */
export function summarizeOngkir(rows: CashierOngkirRow[]): OngkirSummary {
  const s = { count: 0, freeCount: 0, cancelledCount: 0 }
  let charged = new Big(0)
  let free = new Big(0)
  for (const r of rows) {
    if (r.cancelled) {
      s.cancelledCount++
      continue
    }
    s.count++
    if (r.isFreeShipping) {
      s.freeCount++
      free = free.plus(r.freeValue)
    } else {
      charged = charged.plus(r.charged)
    }
  }
  return { ...s, chargedTotal: charged.toNumber(), freeTotal: free.toNumber() }
}

export function filterOngkirRows(rows: CashierOngkirRow[], courierId: number | null, billing: 'ALL' | 'CHARGED' | 'FREE'): CashierOngkirRow[] {
  return rows.filter((r) =>
    (courierId == null || r.courierId === courierId) &&
    (billing === 'ALL' || (billing === 'FREE' ? r.isFreeShipping : !r.isFreeShipping)),
  )
}
