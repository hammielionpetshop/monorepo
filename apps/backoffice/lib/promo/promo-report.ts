import type { PromoQuotaKind, PromoStatus } from './promo-engine'

/** Jatah kuota promo per cabang pada laporan (hanya promo berkuota). */
export interface PromoQuotaView {
  kind: PromoQuotaKind
  /** Jatah per cabang (pcs hadiah atau jumlah nota, sesuai `kind`). */
  perBranch: number
  /** Pemakaian & sisa tiap cabang tempat promo berlaku. */
  usage: { branchId: number; branchName: string; used: number; remaining: number }[]
}

// Laporan Promo (P2f) — hanya membaca nota yang sudah ada. Berkas ini hanya menyusun & menghitung
// (tanpa DB) supaya bisa diuji sendiri; pembacaan DB ada di
// `lib/services/promo-report-service.ts`. Lihat docs/work/specs/2026-10-12-promo-otomatis-design.md.

/** Satu promo di laporan, dengan hasil pemakaiannya dalam periode yang dipilih. */
export interface PromoUsageRow {
  promotionId: number
  /** Nama promo saat nota terbit (cadangan bila promo sudah tak ada di daftar). */
  promotionName: string | null
  /** Jumlah nota yang memakai promo ini. */
  noteCount: number
  /** Jumlah barang (pcs/satuan) yang terjual pada baris berpromo. */
  qty: number
  /** Omzet baris berpromo — nilai yang benar-benar dibayar (sesudah potongan). */
  omzet: number
  /** Total rupiah potongan yang diberikan promo ini. */
  discount: number
  /** Modal (HPP) barang pada baris berpromo. */
  cogs: number
}

/** Pembanding: penjualan barang hadiah promo pada masa promo vs masa sebelumnya (sama panjang). */
export interface PromoBaselineRow {
  promotionId: number
  periodQty: number
  periodOmzet: number
  beforeQty: number
  beforeOmzet: number
}

/** Keterangan promo dari daftar promo (nama terbaru, status, cabang, masa berlaku). */
export interface PromoMetaRow {
  promotionId: number
  name: string
  status: PromoStatus
  branchNames: string[]
  startsAt: string
  endsAt: string
  /** Jatah kuota per cabang; null bila promo tanpa kuota. */
  quota: PromoQuotaView | null
}

/** Pemakaian promo per cabang — untuk peringkat toko. */
export interface BranchUsageRow {
  branchId: number
  branchName: string
  noteCount: number
  qty: number
  omzet: number
  discount: number
}

export interface PromoReportItem {
  promotionId: number
  name: string
  status: PromoStatus | null
  branchNames: string[]
  startsAt: string | null
  endsAt: string | null
  noteCount: number
  qty: number
  omzet: number
  discount: number
  cogs: number
  /** Laba = omzet − modal. Bisa negatif (jual rugi). */
  profit: number
  /** Penjualan barang hadiah: masa promo vs masa sebelumnya (sama panjang). `null` = tak terhitung. */
  comparison: {
    periodQty: number
    periodOmzet: number
    beforeQty: number
    beforeOmzet: number
    /** Selisih qty masa promo − sebelum; dan persentasenya (null bila sebelumnya nol). */
    qtyDelta: number
    qtyChangePct: number | null
  } | null
  /** Jatah kuota per cabang (terpakai/sisa); null bila promo tanpa kuota. */
  quota: PromoQuotaView | null
}

export interface PromoReportTotals {
  noteCount: number
  qty: number
  omzet: number
  discount: number
  profit: number
}

export interface PromoReportView {
  promos: PromoReportItem[]
  branches: BranchUsageRow[]
  totals: PromoReportTotals
}

function changePct(now: number, before: number): number | null {
  if (before <= 0) return null
  return Math.round(((now - before) / before) * 1000) / 10
}

/**
 * Menggabungkan hasil query menjadi tampilan laporan. Daftar promo = gabungan promo yang
 * masanya menyentuh periode (meta) dan promo yang terpakai (usage). Diurutkan: potongan
 * terbesar dulu, lalu nama. Peringkat toko diurutkan potongan terbesar dulu.
 */
export function assemblePromoReport(
  meta: PromoMetaRow[],
  usage: PromoUsageRow[],
  baseline: PromoBaselineRow[],
  branches: BranchUsageRow[],
): PromoReportView {
  const metaById = new Map(meta.map((m) => [m.promotionId, m]))
  const usageById = new Map(usage.map((u) => [u.promotionId, u]))
  const baselineById = new Map(baseline.map((b) => [b.promotionId, b]))

  const ids = new Set<number>()
  for (const m of meta) ids.add(m.promotionId)
  for (const u of usage) ids.add(u.promotionId)

  const promos: PromoReportItem[] = [...ids].map((id) => {
    const m = metaById.get(id)
    const u = usageById.get(id)
    const b = baselineById.get(id)
    const omzet = u?.omzet ?? 0
    const cogs = u?.cogs ?? 0
    const comparison = b
      ? {
          periodQty: b.periodQty,
          periodOmzet: b.periodOmzet,
          beforeQty: b.beforeQty,
          beforeOmzet: b.beforeOmzet,
          qtyDelta: b.periodQty - b.beforeQty,
          qtyChangePct: changePct(b.periodQty, b.beforeQty),
        }
      : null
    return {
      promotionId: id,
      name: m?.name ?? u?.promotionName ?? `Promo #${id}`,
      status: m?.status ?? null,
      branchNames: m?.branchNames ?? [],
      startsAt: m?.startsAt ?? null,
      endsAt: m?.endsAt ?? null,
      noteCount: u?.noteCount ?? 0,
      qty: u?.qty ?? 0,
      omzet,
      discount: u?.discount ?? 0,
      cogs,
      profit: omzet - cogs,
      comparison,
      quota: m?.quota ?? null,
    }
  })

  promos.sort((a, z) => z.discount - a.discount || a.name.localeCompare(z.name, 'id'))

  const ranking = [...branches].sort(
    (a, z) => z.discount - a.discount || z.omzet - a.omzet || a.branchName.localeCompare(z.branchName, 'id'),
  )

  const totals = promos.reduce<PromoReportTotals>(
    (t, p) => {
      t.noteCount += p.noteCount
      t.qty += p.qty
      t.omzet += p.omzet
      t.discount += p.discount
      t.profit += p.profit
      return t
    },
    { noteCount: 0, qty: 0, omzet: 0, discount: 0, profit: 0 },
  )

  return { promos, branches: ranking, totals }
}
