import { applyPromos, type PromoContext, type PromoLineResult, type PromoRule } from './promo-engine'

// ── SERVER SEBAGAI HAKIM PROMO (P2c) ────────────────────────────────────────────────────────
// Saat nota disimpan, server menghitung ulang promo dengan mesin promo memakai jam server dan
// daftar promo dari database, lalu membandingkannya dengan promo yang dikirim layar kasir per
// baris. Berbeda sedikit saja (promo baru mulai, sudah berakhir, dimatikan, jumlah potongan
// lain) → nota ditolak dan layar menghitung ulang. Berkas ini murni hitungan; membaca database
// dan mencatat hasilnya ada di `lib/services/promo-sale-service.ts`.
//
// Di luar jangkauan promo (Penjualan Grosir, PO Internal, nota sinkron offline) tidak dihitung
// dan baris yang membawa promo ditolak.

/** Promo satu baris seperti dikirim layar kasir. `amount` = potongan untuk seluruh baris. */
export interface PromoClaim {
  promoId: number
  amount: number
}

export interface PromoJudgeLine {
  productId: number
  uomId: number
  qty: number
  unitPrice: number
  priceTier: string
  /** Jumlah semua potongan baris itu menurut layar. */
  discountAmount: number
  /** Yang ditagih untuk baris itu menurut layar. */
  subtotal: number
  promo?: PromoClaim | null
  hasManualDiscount?: boolean
  /** Baris yang tidak boleh kena promo (ongkos kirim). */
  excluded?: boolean
}

export interface PromoJudgeTotals {
  subtotal: number
  discountTotal: number
  grandTotal: number
}

/** PROMO_CHANGED = promo yang berlaku berbeda dari hitungan layar (layar perlu menghitung ulang). */
export type PromoJudgeCode = 'PROMO_CHANGED' | 'PROMO_INVALID'

export type PromoJudgement =
  | { ok: true; awards: (PromoLineResult | null)[] }
  | { ok: false; code: PromoJudgeCode; message: string }

const RECOUNT = 'Keranjang dihitung ulang — periksa lalu bayar lagi.'

const fail = (code: PromoJudgeCode, message: string): PromoJudgement => ({ ok: false, code, message })

export function judgePromos(
  lines: PromoJudgeLine[],
  rules: PromoRule[],
  ctx: PromoContext & { outOfScope?: boolean },
  totals: PromoJudgeTotals,
): PromoJudgement {
  const nameOf = (promoId: number) => rules.find((r) => r.id === promoId)?.name ?? 'yang dipilih'

  if (ctx.outOfScope) {
    if (lines.some((l) => l.promo)) return fail('PROMO_INVALID', 'Promo tidak berlaku untuk nota ini')
    return { ok: true, awards: lines.map(() => null) }
  }

  const result = applyPromos(
    lines.map((l, index) => ({
      key: String(index),
      productId: l.productId,
      uomId: l.uomId,
      qty: l.qty,
      unitPrice: l.unitPrice,
      priceTier: l.priceTier,
      excluded: l.excluded,
    })),
    rules,
    ctx,
  )
  const expectedByIndex = new Map(result.lines.map((r) => [Number(r.key), r]))

  for (const [index, line] of lines.entries()) {
    const expected = expectedByIndex.get(index)
    const sent = line.promo ?? null
    if (expected && !sent) return fail('PROMO_CHANGED', `Ada promo yang sedang berlaku: "${expected.promoName}". ${RECOUNT}`)
    if (!expected && sent) return fail('PROMO_CHANGED', `Promo "${nameOf(sent.promoId)}" sudah tidak berlaku untuk keranjang ini. ${RECOUNT}`)
    if (!expected || !sent) continue
    if (expected.promoId !== sent.promoId || expected.amount !== sent.amount) {
      return fail('PROMO_CHANGED', `Promo berubah menjadi "${expected.promoName}". ${RECOUNT}`)
    }
    if (line.hasManualDiscount) return fail('PROMO_INVALID', 'Barang promo tidak bisa diberi diskon manual')
    if (line.discountAmount !== expected.amount || line.subtotal !== line.qty * line.unitPrice - expected.amount) {
      return fail('PROMO_INVALID', 'Hitungan promo tidak cocok. Muat ulang halaman kasir, lalu ulangi.')
    }
  }

  if (result.lines.length > 0) {
    if (totals.discountTotal !== 0) return fail('PROMO_INVALID', 'Promo tidak bisa digabung dengan diskon total nota')
    const sum = lines.reduce((acc, l) => acc + l.subtotal, 0)
    if (totals.subtotal !== sum || totals.grandTotal !== sum) {
      return fail('PROMO_INVALID', 'Total nota tidak cocok dengan isi keranjang. Muat ulang halaman kasir, lalu ulangi.')
    }
  }

  return { ok: true, awards: lines.map((_, index) => expectedByIndex.get(index) ?? null) }
}
