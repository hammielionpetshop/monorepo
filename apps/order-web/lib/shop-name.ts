import { db, eq, branches } from '@/lib/db';
import { orderBranchId } from '@/lib/services/catalog-service';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { value: string; expiresAt: number } | null = null;

/**
 * Nama toko di header portal, dipakai kelima halaman.
 *
 * Sebelumnya tiap halaman menyalin query ini dan Next memanggilnya sekali saat build
 * (halaman jadi statis). Sejak halaman-halaman itu `force-dynamic` — supaya build tidak
 * lagi menuntut koneksi DB — query ini akan jalan tiap request, dan sejak deployment
 * pindah ke VPS terpisah dari Postgres, tiap query itu melintasi jaringan. Proses di VPS
 * hidup lama, jadi cache di memori cukup; nilainya nyaris tak pernah berubah.
 *
 * Kalau DB tak terjangkau, kembalikan nilai lama/bawaan alih-alih menggagalkan halaman:
 * dulu halaman ini statis dan tak pernah bisa gagal karena DB, jadi jangan malah
 * menambah mode gagal baru hanya demi satu string kosmetik.
 */
export async function getShopName(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const [branch] = await db
      .select({ receiptName: branches.receiptName })
      .from(branches)
      .where(eq(branches.id, orderBranchId()))
      .limit(1);
    const value = branch?.receiptName ?? 'Hammielion';
    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (error) {
    console.error('Gagal membaca nama toko:', error);
    return cached?.value ?? 'Hammielion';
  }
}
