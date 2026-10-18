import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, products, unitsOfMeasure, inArray } from '@/lib/db'
import { getPromoEnabled, loadPromoRules } from '@/lib/services/promo-service'
import { loadPromoUsageContext } from '@/lib/services/promo-sale-service'
import type { PromoRule } from '@/lib/promo/promo-engine'

// Nama & satuan barang hadiah GRATIS (beli X gratis Y, P4d) untuk ditampilkan di keranjang & struk
// kasir — barang gratis tidak ada di keranjang, jadi namanya dikirim dari server. Peta `produk:satuan`.
async function loadRewardInfo(rules: PromoRule[]): Promise<Record<string, { name: string; uomCode: string }>> {
  const gifts = rules.flatMap((r) => r.rewards.filter((rw) => rw.type === 'GRATIS').map((rw) => ({ productId: rw.productId, uomId: rw.uomId })))
  if (gifts.length === 0) return {}
  const productIds = [...new Set(gifts.map((g) => g.productId))]
  const uomIds = [...new Set(gifts.map((g) => g.uomId))]
  const [productRows, uomRows] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds)),
    db.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code }).from(unitsOfMeasure).where(inArray(unitsOfMeasure.id, uomIds)),
  ])
  const nameOf = new Map(productRows.map((p) => [p.id, p.name]))
  const codeOf = new Map(uomRows.map((u) => [u.id, u.code]))
  const info: Record<string, { name: string; uomCode: string }> = {}
  for (const g of gifts) info[`${g.productId}:${g.uomId}`] = { name: nameOf.get(g.productId) ?? '', uomCode: codeOf.get(g.uomId) ?? '' }
  return info
}

export const dynamic = 'force-dynamic'

// Promo untuk layar kasir cabang ini: saklar darurat, jam server, dan promo aktif yang belum
// berakhir. Layar menghitung promo keranjang dengan mesin promo yang sama memakai jam server
// (`serverNow`); saat nota disimpan server tetap menghitung ulang dan menjadi hakimnya.
//
// Sisa jatah kuota & stok barang hadiah ikut dikirim (P3c) supaya perkiraan layar mendekati —
// promo berkuota diam-diam berhenti saat jatah/stok habis. Keputusan akhir tetap di server.
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })

    const now = new Date()
    const branchId = getPosBranchId(payload, cookieStore)
    const enabled = await getPromoEnabled()
    const promos = enabled ? await loadPromoRules(branchId, now) : []
    const usage = promos.length > 0
      ? await loadPromoUsageContext(db, branchId, promos)
      : { remainingQuota: new Map<number, number>(), stock: new Map<string, number>(), rewardPrices: new Map<string, number>() }
    const remainingQuota = Object.fromEntries(usage.remainingQuota)
    const stock = Object.fromEntries(usage.stock)
    const rewardPrices = Object.fromEntries(usage.rewardPrices)
    const rewardInfo = promos.length > 0 ? await loadRewardInfo(promos) : {}
    return NextResponse.json({ enabled, serverNow: now.toISOString(), branchId, promos, remainingQuota, stock, rewardPrices, rewardInfo })
  } catch (error) {
    console.error('GET /api/pos/promos error:', error)
    return NextResponse.json({ error: 'Gagal membaca promo' }, { status: 500 })
  }
}
