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

let ticking = false

export const usePromoStore = create<PromoStore>((set, get) => ({
  enabled: false,
  rules: [],
  branchId: 0,
  clockOffsetMs: 0,
  nowMs: Date.now(),
  remainingQuota: new Map(),
  stock: new Map(),
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const res = await fetch('/api/pos/promos')
      if (!res.ok) {
        set({ enabled: false, rules: [], remainingQuota: new Map(), stock: new Map(), loaded: true, loading: false, nowMs: Date.now() })
        return
      }
      const data = (await res.json()) as {
        enabled?: boolean
        serverNow?: string
        branchId?: number
        promos?: PromoRule[]
        remainingQuota?: Record<string, number>
        stock?: Record<string, number>
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
        loaded: true,
        loading: false,
      })
    } catch {
      // Gagal memuat = anggap tidak ada promo. Server tetap menolak nota yang seharusnya berpromo,
      // jadi kasir tidak bisa diam-diam melewatkan promo — layar tinggal menghitung ulang.
      set({ enabled: false, rules: [], remainingQuota: new Map(), stock: new Map(), loaded: true, loading: false, nowMs: Date.now() })
    }

    if (!ticking && typeof window !== 'undefined') {
      ticking = true
      window.setInterval(() => {
        set({ nowMs: Date.now() + get().clockOffsetMs })
      }, 30000)
    }
  },
}))
