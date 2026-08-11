import { cache } from 'react';
import type { UserRole } from '@petshop/shared';
import { db, userSessions, eq, and, isNull } from '@/lib/db';

export type RevokedReason = 'TAKEN_OVER' | 'LOGOUT';

/**
 * Role yang boleh memegang beberapa sesi hidup sekaligus.
 *
 * OWNER & GM berpindah perangkat sepanjang hari — ponsel di toko, laptop di rumah, PC kantor —
 * dan aturan satu sesi membuat mereka saling menendang diri sendiri setiap pindah.
 *
 * Ongkosnya sadar dan hanya berlaku untuk dua role ini: sesi di perangkat yang hilang TIDAK
 * lagi bisa diputus dengan cara login dari perangkat lain, dan belum ada layar mana pun untuk
 * mencabutnya manual. Menonaktifkan akun (`users.is_active = false`) hanya menutup login
 * berikutnya, bukan token yang sudah terbit — token itu mati sendiri dalam 1 hari
 * (lihat `signAccessToken`). Untuk role lain aturan satu sesi tetap utuh.
 */
const MULTI_SESSION_ROLES: readonly UserRole[] = ['OWNER', 'GM'];

export function allowsConcurrentSessions(role: UserRole): boolean {
  return MULTI_SESSION_ROLES.includes(role);
}

/**
 * Mulai sesi baru. Untuk role yang tidak ada di `MULTI_SESSION_ROLES`, sesi lain milik user
 * yang sama sekaligus dicabut.
 *
 * Pencabutan dan pembuatan dijalankan dalam satu transaksi supaya tidak pernah ada momen di
 * mana user punya dua sesi hidup — atau nol, kalau insert-nya gagal setelah pencabutan berhasil.
 *
 * `role` wajib diisi, bukan opsional dengan default: pemanggil baru harus menyebut role-nya
 * secara sadar, karena default apa pun di sini akan salah untuk sebagian role tanpa bersuara.
 */
export async function startSession(
  userId: number,
  deviceLabel: string | null,
  role: UserRole,
): Promise<number> {
  return await db.transaction(async (trx) => {
    if (!allowsConcurrentSessions(role)) {
      await trx
        .update(userSessions)
        .set({ revokedAt: new Date(), revokedReason: 'TAKEN_OVER' })
        .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
    }

    const [created] = await trx
      .insert(userSessions)
      .values({ userId, deviceLabel })
      .returning({ id: userSessions.id });

    return created.id;
  });
}

export async function revokeSession(sessionId: number, reason: RevokedReason): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
}

/**
 * Apakah sesi ini masih hidup. Dipanggil `verifyAccessToken` di setiap request.
 *
 * Dibungkus `cache()` React: satu render halaman bisa memanggil `verifyAccessToken` beberapa
 * kali (layout, page, lalu beberapa server component), dan tanpa ini setiap panggilan jadi satu
 * query. Dengan dedupe, satu render = satu query. Route handler memang sekali panggil.
 */
export const isSessionActive = cache(async (sessionId: number): Promise<boolean> => {
  const [row] = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)))
    .limit(1);

  return Boolean(row);
});
