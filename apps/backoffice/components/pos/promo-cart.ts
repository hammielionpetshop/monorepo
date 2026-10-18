'use client'

import { useMemo } from 'react'
import Big from 'big.js'
import { applyPromos, PROMO_TIER, type PromoGift, type PromoLineResult, type PromoRule } from '@/lib/promo/promo-engine'
import { isOngkirItem } from '@/lib/ongkir'
import type { CartItem } from './cart-store'
import { usePromoStore } from './promo-store'

// Promo di keranjang kasir (P2d) — lapisan hitung di layar. Memakai mesin promo yang sama dengan
// server (`lib/promo/promo-engine.ts`) supaya angka di layar = angka server. Hasilnya SELARAS
// dengan urutan `items`: tiap elemen = potongan promo baris itu, atau null bila tidak kena promo.
// Promo TIDAK pernah disimpan di keranjang — selalu dihitung ulang dari isi keranjang + promo yang
// berlaku + jam server, jadi daftar tunggu yang dibuka lagi otomatis ikut promo terbaru.

export interface PromoCartInput {
  enabled: boolean
  rules: PromoRule[]
  branchId: number
  nowMs: number
  /** Sisa jatah kuota per promo (id → sisa) untuk cabang ini (P3d); kosong = jatah dianggap penuh. */
  remainingQuota?: Map<number, number>
  /** Sisa stok barang hadiah per `produk:satuan` (promo bersyarat stok); kosong = dianggap ada. */
  stock?: Map<string, number>
  /** Harga Retail barang hadiah GRATIS per `produk:satuan` (P4d); tanpa harga = hadiah dilewati. */
  rewardPrices?: Map<string, number>
}

/**
 * Hasil promo keranjang di layar: potongan per baris (selaras urutan `items`) DAN barang hadiah
 * gratis yang harus ditambahkan sebagai baris tersendiri (beli X gratis Y, P4d). Nota di luar
 * jangkauan promo (PO Internal) atau saklar darurat mati → tidak ada apa pun.
 */
export function cartPromoResult(
  items: CartItem[],
  customerTier: string | null,
  outOfScope: boolean,
  input: PromoCartInput,
): { awards: (PromoLineResult | null)[]; gifts: PromoGift[] } {
  if (outOfScope || !input.enabled || input.rules.length === 0 || items.length === 0) {
    return { awards: items.map(() => null), gifts: [] }
  }
  const result = applyPromos(
    items.map((item, index) => ({
      key: String(index),
      productId: item.productId,
      uomId: item.uomId,
      qty: item.qty,
      unitPrice: Math.round(Number(item.unitPrice)),
      priceTier: item.priceTier,
      excluded: isOngkirItem(item),
    })),
    input.rules,
    {
      branchId: input.branchId,
      customerTier,
      now: new Date(input.nowMs),
      enabled: input.enabled,
      internalPo: outOfScope,
      remainingQuota: input.remainingQuota,
      stock: input.stock,
      rewardPrices: input.rewardPrices,
    },
  )
  const byIndex = new Map(result.lines.map((line) => [Number(line.key), line]))
  return { awards: items.map((_, index) => byIndex.get(index) ?? null), gifts: result.gifts }
}

/**
 * Potongan promo tiap baris keranjang (selaras urutan `items`). Nota di luar jangkauan promo
 * (PO Internal) atau saklar darurat mati → semua null. Ongkos kirim tidak pernah kena promo.
 */
export function cartPromoAwards(
  items: CartItem[],
  customerTier: string | null,
  outOfScope: boolean,
  input: PromoCartInput,
): (PromoLineResult | null)[] {
  return cartPromoResult(items, customerTier, outOfScope, input).awards
}

/**
 * Barang hadiah gratis (keluaran mesin) → baris keranjang tambahan (P4d). Ditandai `promoGift`
 * supaya layar bayar mengirimnya bertanda `promo.gift` dan kasir tidak bisa menghapusnya. Nama &
 * satuan barang diambil dari `rewardInfo` (server); tanpa data itu baris tetap tampil dengan nama
 * cadangan — harga & potongannya tetap benar.
 */
export function cartGiftLines(
  gifts: PromoGift[],
  rewardInfo: Map<string, { name: string; uomCode: string }>,
): CartItem[] {
  return gifts.map((gift) => {
    const info = rewardInfo.get(`${gift.productId}:${gift.uomId}`)
    return {
      productId: gift.productId,
      productName: info?.name || 'Barang hadiah',
      uomId: gift.uomId,
      uomCode: info?.uomCode || '',
      qty: gift.qty,
      unitPrice: String(gift.unitPrice),
      priceTier: PROMO_TIER,
      discountAmount: String(gift.amount),
      subtotal: '0',
      tierPrices: {},
      promoGift: { promoId: gift.promoId, promoName: gift.promoName },
    }
  })
}

/** Tagihan satu baris sesudah promo (rupiah, string). Baris tanpa promo = subtotalnya apa adanya. */
export function promoLineSubtotal(item: CartItem, award: PromoLineResult | null): string {
  if (!award) return item.subtotal
  return new Big(item.unitPrice).times(item.qty).minus(award.amount).round(0).toString()
}

/** Total keranjang sesudah promo. */
export function cartPromoGrandTotal(items: CartItem[], awards: (PromoLineResult | null)[]): string {
  if (items.length === 0) return '0'
  return items
    .reduce((acc, item, index) => acc.plus(promoLineSubtotal(item, awards[index] ?? null)), new Big(0))
    .round(0)
    .toString()
}

/** Jumlah seluruh potongan promo di keranjang (rupiah, string). */
export function cartPromoTotal(awards: (PromoLineResult | null)[]): string {
  return awards.reduce((acc, award) => acc.plus(award ? award.amount : 0), new Big(0)).round(0).toString()
}

/**
 * Hook: hasil promo keranjang (potongan per baris + baris hadiah gratis), dihitung ulang saat
 * keranjang, golongan pelanggan, promo, atau jam server berubah. Dipakai panel keranjang & layar
 * bayar supaya hitungannya sama. `giftLines` = baris hadiah gratis yang harus ditambahkan ke nota.
 */
export function usePromoCart(
  items: CartItem[],
  customerTier: string | null,
  outOfScope: boolean,
): { awards: (PromoLineResult | null)[]; giftLines: CartItem[] } {
  const enabled = usePromoStore((s) => s.enabled)
  const rules = usePromoStore((s) => s.rules)
  const branchId = usePromoStore((s) => s.branchId)
  const nowMs = usePromoStore((s) => s.nowMs)
  const remainingQuota = usePromoStore((s) => s.remainingQuota)
  const stock = usePromoStore((s) => s.stock)
  const rewardPrices = usePromoStore((s) => s.rewardPrices)
  const rewardInfo = usePromoStore((s) => s.rewardInfo)
  return useMemo(() => {
    const { awards, gifts } = cartPromoResult(items, customerTier, outOfScope, {
      enabled, rules, branchId, nowMs, remainingQuota, stock, rewardPrices,
    })
    return { awards, giftLines: cartGiftLines(gifts, rewardInfo) }
  }, [items, customerTier, outOfScope, enabled, rules, branchId, nowMs, remainingQuota, stock, rewardPrices, rewardInfo])
}

/**
 * Hook: potongan promo tiap baris keranjang (tanpa baris hadiah gratis). Dipakai di tempat yang
 * cuma butuh total/penandaan baris (mis. ringkasan & daftar tunggu). Hadiah gratis bernilai 0
 * terhadap total, jadi total tetap benar tanpa menyusun baris hadiah di sini.
 */
export function usePromoAwards(
  items: CartItem[],
  customerTier: string | null,
  outOfScope: boolean,
): (PromoLineResult | null)[] {
  return usePromoCart(items, customerTier, outOfScope).awards
}
