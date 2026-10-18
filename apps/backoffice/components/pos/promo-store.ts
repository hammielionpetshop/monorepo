'use client'

import { create } from 'zustand'
import type { PromoRule } from '@/lib/promo/promo-engine'

// Promo yang sedang berlaku untuk cabang kasir ini (P2d). Diisi dari `GET /api/pos/promos`
// (saklar darurat, jam server, promo aktif yang belum berakhir). Layar menghitung promo keranjang
// dengan mesin promo yang sama (`lib/promo/promo-engine.ts`); server tetap menjadi hakimnya saat
// nota disimpan, jadi angka di sini hanyalah perkiraan yang ditampilkan ke kasir.
//
// `clockOffsetMs` = selisih jam server − jam perangkat saat diambil, supaya promo berjam (flash
// sale) dihitung memakai jam server walau jam komputer kasir meleset. `nowMs` di-tik tiap 30 detik
// agar promo yang mulai / berakhir di tengah sesi ikut muncul / hilang tanpa memuat ulang halaman.

interface PromoStore {
  enabled: boolean
  rules: PromoRule[]
  branchId: number
  clockOffsetMs: number
  /** Jam server perkiraan (ms). Di-tik berkala supaya batas jam promo ikut berubah. */
  nowMs: number
  /**
   * Sisa jatah kuota per promo (id → sisa) untuk cabang ini, dari server (P3d). Dipakai mesin promo
   * di layar supaya promo berkuota diam-diam berhenti saat jatah habis. Hanya perkiraan — server
   * tetap menghakimi saat nota disimpan, jadi angka ini bisa sedikit tertinggal bila kasir lain
   * memakai jatah di saat bersamaan (nota akan ditolak `PROMO_CHANGED` lalu dihitung ulang).
   */
  remainingQuota: Map<number, number>
  /** Sisa stok barang hadiah per `produk:satuan` di cabang ini (promo bersyarat stok). */
  stock: Map<string, number>
  /**
   * Harga Retail barang hadiah GRATIS per `produk:satuan` di cabang ini (P4d). Mesin promo butuh
   * ini untuk membentuk baris hadiah (barang gratis tidak ada di keranjang). Server menyuplai
   * harga yang sama saat menghakimi nota, jadi angka layar = angka server.
   */
  rewardPrices: Map<string, number>
  /**
   * Nama & satuan barang hadiah GRATIS per `produk:satuan` (P4d) — hanya untuk menampilkan baris
   * hadiah di keranjang & struk (server tidak memerlukannya; ia mencari sendiri dari database).
   */
  rewardInfo: Map<string, { name: string; uomCode: string }>
  loaded: boolean
  loading: boolean
  /** Ambil / muat ulang promo. Dipanggil saat layar kasir dibuka dan saat nota ditolak server. */
  load: () => Promise<void>
}

/** Ubah objek `{ "kunci": angka }` dari JSON jadi Map dengan kunci sesuai penafsir. */
function toMap<K>(obj: unknown, parseKey: (key: string) => K): Map<K, number> {
  const map = new Map<K, number>()
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const num = Number(value)
      if (Number.isFinite(num)) map.set(parseKey(key), num)
    }
  }
  return map
}

/** Ubah objek `{ "produk:satuan": { name, uomCode } }` dari JSON jadi Map (nama barang hadiah). */
function toInfoMap(obj: unknown): Map<string, { name: string; uomCode: string }> {
  const map = new Map<string, { name: string; uomCode: string }>()
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        const v = value as { name?: unknown; uomCode?: unknown }
        map.set(key, { name: String(v.name ?? ''), uomCode: String(v.uomCode ?? '') })
      }
    }
  }
  return map
}

const EMPTY_STATE = {
  enabled: false,
  rules: [] as PromoRule[],
  remainingQuota: new Map<number, number>(),
  stock: new Map<string, number>(),
  rewardPrices: new Map<string, number>(),
  rewardInfo: new Map<string, { name: string; uomCode: string }>(),
  loaded: true,
  loading: false,
}

let ticking = false

export const usePromoStore = create<PromoStore>((set, get) => ({
  enabled: false,
  rules: [],
  branchId: 0,
  clockOffsetMs: 0,
  nowMs: Date.now(),
  remainingQuota: new Map(),
  stock: new Map(),
  rewardPrices: new Map(),
  rewardInfo: new Map(),
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const res = await fetch('/api/pos/promos')
      if (!res.ok) {
        set({ ...EMPTY_STATE, nowMs: Date.now() })
        return
      }
      const data = (await res.json()) as {
        enabled?: boolean
        serverNow?: string
        branchId?: number
        promos?: PromoRule[]
        remainingQuota?: Record<string, number>
        stock?: Record<string, number>
        rewardPrices?: Record<string, number>
        rewardInfo?: Record<string, { name: string; uomCode: string }>
      }
      const serverMs = data.serverNow ? new Date(data.serverNow).getTime() : Date.now()
      const offset = Number.isFinite(serverMs) ? serverMs - Date.now() : 0
      set({
        enabled: Boolean(data.enabled),
        rules: Array.isArray(data.promos) ? data.promos : [],
        branchId: Number(data.branchId) || 0,
        clockOffsetMs: offset,
        nowMs: Date.now() + offset,
        remainingQuota: toMap(data.remainingQuota, Number),
        stock: toMap(data.stock, (key) => key),
        rewardPrices: toMap(data.rewardPrices, (key) => key),
        rewardInfo: toInfoMap(data.rewardInfo),
        loaded: true,
        loading: false,
      })
    } catch {
      // Gagal memuat = anggap tidak ada promo. Server tetap menolak nota yang seharusnya berpromo,
      // jadi kasir tidak bisa diam-diam melewatkan promo — layar tinggal menghitung ulang.
      set({ ...EMPTY_STATE, nowMs: Date.now() })
    }

    if (!ticking && typeof window !== 'undefined') {
      ticking = true
      window.setInterval(() => {
        set({ nowMs: Date.now() + get().clockOffsetMs })
      }, 30000)
    }
  },
}))
