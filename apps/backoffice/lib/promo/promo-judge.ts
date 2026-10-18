import { applyPromos, PROMO_TIER, type PromoContext, type PromoKind, type PromoLineResult, type PromoRule } from './promo-engine'

// ── SERVER SEBAGAI HAKIM PROMO (P2c, hadiah gratis P4c) ─────────────────────────────────────
// Saat nota disimpan, server menghitung ulang promo dengan mesin promo memakai jam server dan
// daftar promo dari database, lalu membandingkannya dengan promo yang dikirim layar kasir per
// baris. Berbeda sedikit saja (promo baru mulai, sudah berakhir, dimatikan, jumlah potongan
// lain) → nota ditolak dan layar menghitung ulang. Berkas ini murni hitungan; membaca database
// dan mencatat hasilnya ada di `lib/services/promo-sale-service.ts`.
//
// Hadiah gratis (beli X gratis Y, P4c): baris hadiah dikirim layar bertanda `promo.gift` dengan
// harga penuh, potongan penuh, dan tagihan 0. Baris itu TIDAK ikut dihitung mesin (bukan barang
// yang dibeli) — ia dicocokkan dengan keluaran `gifts` mesin (produk, satuan, qty, harga, nilai).
//
// Di luar jangkauan promo (Penjualan Grosir, PO Internal, nota sinkron offline) tidak dihitung
// dan baris yang membawa promo ditolak.

/** Promo satu baris seperti dikirim layar kasir. `amount` = potongan untuk seluruh baris. */
export interface PromoClaim {
  promoId: number
  amount: number
  /** TRUE = baris hadiah gratis tambahan (bukan barang yang dibeli). */
  gift?: boolean
}

/** Promo paket (beli X gratis Y / bundling) menandai baris segrupnya untuk "retur paket utuh". */
const PACKAGE_KINDS: readonly PromoKind[] = ['BELI_GRATIS', 'BUNDLING']

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
  | { ok: true; awards: (PromoLineResult | null)[]; packageNos: (number | null)[] }
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
    return { ok: true, awards: lines.map(() => null), packageNos: lines.map(() => null) }
  }

  // Baris hadiah gratis (`promo.gift`) tidak ikut dihitung mesin — ia dicocokkan dengan keluaran
  // `gifts` mesin di bawah. Hanya baris barang yang dibeli yang masuk ke mesin.
  const giftIdx = new Set<number>()
  lines.forEach((l, i) => { if (l.promo?.gift) giftIdx.add(i) })

  const result = applyPromos(
    lines
      .map((l, index) => ({
        key: String(index),
        productId: l.productId,
        uomId: l.uomId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        priceTier: l.priceTier,
        excluded: l.excluded,
      }))
      .filter((_, index) => !giftIdx.has(index)),
    rules,
    ctx,
  )
  const expectedByIndex = new Map(result.lines.map((r) => [Number(r.key), r]))

  for (const [index, line] of lines.entries()) {
    if (giftIdx.has(index)) continue
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

  // Cocokkan baris hadiah gratis kiriman dengan hadiah yang dihitung mesin (satu lawan satu).
  const giftAwards = new Map<number, PromoLineResult>()
  const unmatchedGifts = [...result.gifts]
  for (const index of giftIdx) {
    const line = lines[index]!
    const sent = line.promo!
    const gi = unmatchedGifts.findIndex((g) => g.productId === line.productId && g.uomId === line.uomId && g.promoId === sent.promoId)
    if (gi < 0) return fail('PROMO_CHANGED', `Hadiah gratis "${nameOf(sent.promoId)}" sudah tidak berlaku untuk keranjang ini. ${RECOUNT}`)
    const gift = unmatchedGifts.splice(gi, 1)[0]!
    if (line.qty !== gift.qty || line.unitPrice !== gift.unitPrice || sent.amount !== gift.amount) {
      return fail('PROMO_CHANGED', `Hadiah gratis "${gift.promoName}" berubah. ${RECOUNT}`)
    }
    if (line.hasManualDiscount) return fail('PROMO_INVALID', 'Barang promo tidak bisa diberi diskon manual')
    if (line.discountAmount !== gift.amount || line.subtotal !== 0) {
      return fail('PROMO_INVALID', 'Hitungan hadiah gratis tidak cocok. Muat ulang halaman kasir, lalu ulangi.')
    }
    giftAwards.set(index, { key: String(index), promoId: gift.promoId, promoName: gift.promoName, units: gift.qty, amount: gift.amount })
  }
  // Hadiah yang seharusnya ada tetapi layar belum menambahkannya.
  if (unmatchedGifts.length > 0) {
    return fail('PROMO_CHANGED', `Ada hadiah gratis dari promo "${unmatchedGifts[0]!.promoName}". ${RECOUNT}`)
  }

  if (result.lines.length > 0 || result.gifts.length > 0) {
    if (totals.discountTotal !== 0) return fail('PROMO_INVALID', 'Promo tidak bisa digabung dengan diskon total nota')
    const sum = lines.reduce((acc, l) => acc + l.subtotal, 0)
    if (totals.subtotal !== sum || totals.grandTotal !== sum) {
      return fail('PROMO_INVALID', 'Total nota tidak cocok dengan isi keranjang. Muat ulang halaman kasir, lalu ulangi.')
    }
  }

  // Nomor grup paket (P4c): tiap promo paket yang dipakai menandai baris syaratnya + baris
  // hadiahnya sebagai satu grup, supaya retur hanya boleh satu paket utuh (P4e). Nomor urut per
  // nota. Promo potongan biasa (satu barang, tanpa paket) tidak membentuk grup.
  const packageNos: (number | null)[] = lines.map(() => null)
  const packagePromoIds = result.applied
    .map((a) => rules.find((r) => r.id === a.promoId))
    .filter((r): r is PromoRule => r != null && PACKAGE_KINDS.includes(r.kind))
    .map((r) => r.id)
    .sort((a, b) => a - b)
  packagePromoIds.forEach((promoId, seq) => {
    const rule = rules.find((r) => r.id === promoId)!
    const memberKeys = new Set([...rule.conditions, ...rule.rewards].map((it) => `${it.productId}:${it.uomId}`))
    lines.forEach((line, index) => {
      const isGiftOfThis = giftIdx.has(index) && line.promo?.promoId === promoId
      const isCartMember = !giftIdx.has(index)
        && !line.excluded
        && line.priceTier === PROMO_TIER
        && memberKeys.has(`${line.productId}:${line.uomId}`)
      if (isGiftOfThis || isCartMember) packageNos[index] = seq + 1
    })
  })

  const awards = lines.map((_, index) => giftAwards.get(index) ?? expectedByIndex.get(index) ?? null)
  return { ok: true, awards, packageNos }
}
