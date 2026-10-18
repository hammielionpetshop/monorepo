'use client'

import { useMemo } from 'react'
import Big from 'big.js'
import { applyPromos, type PromoLineResult, type PromoRule } from '@/lib/promo/promo-engine'
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
  if (outOfScope || !input.enabled || input.rules.length === 0 || items.length === 0) {
    return items.map(() => null)
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
    },
  )
  const byIndex = new Map(result.lines.map((line) => [Number(line.key), line]))
  return items.map((_, index) => byIndex.get(index) ?? null)
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
 * Hook: potongan promo tiap baris keranjang, dihitung ulang saat keranjang, golongan pelanggan,
 * promo, atau jam server berubah. Dipakai panel keranjang & layar bayar supaya hitungannya sama.
 */
export function usePromoAwards(
  items: CartItem[],
  customerTier: string | null,
  outOfScope: boolean,
): (PromoLineResult | null)[] {
  const enabled = usePromoStore((s) => s.enabled)
  const rules = usePromoStore((s) => s.rules)
  const branchId = usePromoStore((s) => s.branchId)
  const nowMs = usePromoStore((s) => s.nowMs)
  const remainingQuota = usePromoStore((s) => s.remainingQuota)
  const stock = usePromoStore((s) => s.stock)
  return useMemo(
    () => cartPromoAwards(items, customerTier, outOfScope, { enabled, rules, branchId, nowMs, remainingQuota, stock }),
    [items, customerTier, outOfScope, enabled, rules, branchId, nowMs, remainingQuota, stock],
  )
}
