import { cookies } from 'next/headers';
import { isCentralMode } from '@/lib/central-cookie-name';
import { revokeSession, type RevokedReason } from '@/lib/services/user-session';

/**
 * Akhiri sesi di SERVER. Mode legacy mencabut `user_sessions`; mode central mencabut sesi
 * pusat sehingga seluruh akses perangkat itu (juga HRIS) ditolak, lalu menghapus cookie
 * sesi pusat. Pemanggil tetap menghapus cookie `accessToken`-nya sendiri.
 */
export async function terminateSession(sessionId: number | undefined, reason: RevokedReason): Promise<void> {
  if (isCentralMode()) {
    // Import dinamis: layanan pusat memuat driver Postgres/argon2 yang tak dibutuhkan mode legacy.
    const { endCentralSession } = await import('@/lib/services/central-session');
    const { centralCookie } = await import('@/lib/central-auth');
    await endCentralSession();
    const { name, domain, path } = centralCookie();
    (await cookies()).delete({ name, domain, path });
    return;
  }
  if (sessionId !== undefined) await revokeSession(sessionId, reason);
}
