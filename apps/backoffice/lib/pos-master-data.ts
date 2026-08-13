import { unstable_cache } from 'next/cache'

import { db, paymentMethods, unitsOfMeasure } from '@/lib/db'

/**
 * Satuan ukur & metode pembayaran untuk layar POS.
 *
 * Keduanya tabel master kecil yang nyaris tidak pernah berubah, tapi dulu ditarik lengkap
 * dari DB SETIAP kali kasir membuka `/pos` — dua dari empat query yang dijalankan serentak
 * lewat `Promise.all` melawan pool berukuran 3, sehingga satu request selalu mengantre di
 * pintu masuk POS. Antrean pool postgres.js tidak punya batas waktu, jadi begitu satu slot
 * dipegang koneksi mati, antrean itulah yang menggantung sampai dibunuh platform (504 setelah
 * 300 detik). Lihat catatan yang sama di `nav-badges/route.ts`.
 *
 * Ongkosnya: perubahan satuan ukur atau metode pembayaran baru terlihat di POS setelah
 * paling lama 5 menit. Panggil `revalidateTag` dengan tag di bawah dari route yang mengubah
 * kedua tabel itu kalau perlu langsung terlihat.
 */
export const POS_MASTER_CACHE_TAG = 'pos-master-data'

const REVALIDATE_SECONDS = 300

export const getCachedUnitsOfMeasure = unstable_cache(
  async () => db.select().from(unitsOfMeasure),
  ['pos-units-of-measure'],
  { revalidate: REVALIDATE_SECONDS, tags: [POS_MASTER_CACHE_TAG] },
)

export const getCachedPaymentMethods = unstable_cache(
  async () => db.select().from(paymentMethods),
  ['pos-payment-methods'],
  { revalidate: REVALIDATE_SECONDS, tags: [POS_MASTER_CACHE_TAG] },
)
