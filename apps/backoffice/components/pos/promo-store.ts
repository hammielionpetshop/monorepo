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
  loaded: boolean
  loading: boolean
  /** Ambil / muat ulang promo. Dipanggil saat layar kasir dibuka dan saat nota ditolak server. */
  load: () => Promise<void>
}

let ticking = false

export const usePromoStore = create<PromoStore>((set, get) => ({
  enabled: false,
  rules: [],
  branchId: 0,
  clockOffsetMs: 0,
  nowMs: Date.now(),
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const res = await fetch('/api/pos/promos')
      if (!res.ok) {
        set({ enabled: false, rules: [], loaded: true, loading: false, nowMs: Date.now() })
        return
      }
      const data = (await res.json()) as {
        enabled?: boolean
        serverNow?: string
        branchId?: number
        promos?: PromoRule[]
      }
      const serverMs = data.serverNow ? new Date(data.serverNow).getTime() : Date.now()
      const offset = Number.isFinite(serverMs) ? serverMs - Date.now() : 0
      set({
        enabled: Boolean(data.enabled),
        rules: Array.isArray(data.promos) ? data.promos : [],
        branchId: Number(data.branchId) || 0,
        clockOffsetMs: offset,
        nowMs: Date.now() + offset,
        loaded: true,
        loading: false,
      })
    } catch {
      // Gagal memuat = anggap tidak ada promo. Server tetap menolak nota yang seharusnya berpromo,
      // jadi kasir tidak bisa diam-diam melewatkan promo — layar tinggal menghitung ulang.
      set({ enabled: false, rules: [], loaded: true, loading: false, nowMs: Date.now() })
    }

    if (!ticking && typeof window !== 'undefined') {
      ticking = true
      window.setInterval(() => {
        set({ nowMs: Date.now() + get().clockOffsetMs })
      }, 30000)
    }
  },
}))
