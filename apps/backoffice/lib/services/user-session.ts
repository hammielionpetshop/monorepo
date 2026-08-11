import { cache } from 'react';
import { db, userSessions, eq, and, isNull } from '@/lib/db';

export type RevokedReason = 'TAKEN_OVER' | 'LOGOUT';

/**
 * Mulai sesi baru, sekaligus mencabut sesi lain milik user yang sama.
 *
 * Satu akun = satu sesi aktif. Pencabutan dan pembuatan dijalankan dalam satu transaksi supaya
 * tidak pernah ada momen di mana user punya dua sesi hidup — atau nol, kalau insert-nya gagal
 * setelah pencabutan berhasil.
 */
export async function startSession(
  userId: number,
  deviceLabel: string | null,
): Promise<number> {
  return await db.transaction(async (trx) => {
    await trx
      .update(userSessions)
      .set({ revokedAt: new Date(), revokedReason: 'TAKEN_OVER' })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

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
