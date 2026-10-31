import { cache } from 'react';
import { logoutSession, validateSession } from '@petshop/auth';
import type { JWTPayload } from '@petshop/shared';
import { getAuthSql, readCentralToken } from '@/lib/central-auth';

/** Satu render = satu pemeriksaan DB per token (validateSession mengunci baris akun). */
const validateCached = cache(async (token: string) => validateSession(getAuthSql(), token, 'backoffice'));

/**
 * Apakah JWT ini masih didukung sesi pusat yang hidup. Dipanggil `verifyAccessToken` pada
 * mode central. JWT tanpa `centralSessionId` (token legacy) ditolak — pengguna login ulang.
 */
export async function isCentralAccessValid(payload: JWTPayload): Promise<boolean> {
  if (payload.centralSessionId === undefined) return false;
  let token: string | undefined;
  try {
    token = await readCentralToken();
  } catch {
    return false; // di luar lingkup permintaan
  }
  if (!token) return false;
  const result = await validateCached(token);
  return result.ok && result.sessionId === payload.centralSessionId && result.localUserId === payload.userId;
}

/** Pencabutan di server: seluruh akses sesi perangkat ini ditolak setelahnya. */
export async function endCentralSession(): Promise<void> {
  const token = await readCentralToken();
  if (token) await logoutSession(getAuthSql(), token);
}

/** Akun pusat yang tertaut ke user backoffice, atau null bila belum ada tautan aktif. */
export async function findAccountIdForUser(userId: number): Promise<number | null> {
  const [row] = await getAuthSql()`select account_id from auth.account_links
    where app_code = 'backoffice' and local_user_id = ${userId} and revoked_at is null`;
  return row ? Number(row.account_id) : null;
}

/** User backoffice yang tertaut ke sesi pusat (untuk sesi yang belum punya akses app). */
export async function findUserIdForSession(sessionId: number): Promise<number | null> {
  const [row] = await getAuthSql()`select l.local_user_id from auth.sessions s
    join auth.account_links l on l.account_id = s.account_id and l.app_code = 'backoffice' and l.revoked_at is null
    where s.id = ${sessionId}`;
  return row ? Number(row.local_user_id) : null;
}
