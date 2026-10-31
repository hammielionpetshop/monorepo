import { cache } from 'react';
import { logoutSession, validateSession } from '@petshop/auth';
import type { JWTPayload } from '@petshop/shared';
import { getAuthSql, readCentralToken } from '@/lib/central-auth';
import { getBridgeDeadline } from '@/lib/central-bridge';
import { db, userSessions, users, and, eq, isNull } from '@/lib/db';

/** Satu render = satu pemeriksaan DB per token (validateSession mengunci baris akun). */
const validateCached = cache(async (token: string) => validateSession(getAuthSql(), token, 'backoffice'));

/**
 * Apakah JWT ini masih didukung sesi pusat yang hidup. Dipanggil `verifyAccessToken` pada
 * mode central. JWT tanpa `centralSessionId` (token legacy) hanya diterima lewat jembatan
 * bertenggat (`isLegacyBridgeValid`); di luar jembatan ditolak dan pengguna login ulang.
 */
export async function isCentralAccessValid(payload: JWTPayload): Promise<boolean> {
  if (payload.centralSessionId === undefined) return isLegacyBridgeValid(payload);
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

/**
 * Jembatan token lama. Token legacy diterima hanya bila SEMUA terpenuhi: jembatan masih dalam
 * tenggat (`BO_AUTH_BRIDGE_UNTIL`), token membawa id sesi lama, sesi lama itu milik user yang
 * sama dan belum dicabut, user masih aktif, dan akun pusatnya masih bertaut serta aktif.
 * Token lama tidak pernah dianggap sesi pusat: pemegangnya tidak mendapat akses HRIS.
 */
const legacyBridgeCached = cache(async (sessionId: number, userId: number): Promise<boolean> => {
  const [row] = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(
      eq(userSessions.id, sessionId),
      eq(userSessions.userId, userId),
      isNull(userSessions.revokedAt),
      eq(users.isActive, true),
    ))
    .limit(1);
  if (!row) return false;
  const [account] = await getAuthSql()`select a.is_active from auth.account_links l
    join auth.accounts a on a.id = l.account_id
    where l.app_code = 'backoffice' and l.local_user_id = ${userId} and l.revoked_at is null`;
  return account?.is_active === true;
});

export async function isLegacyBridgeValid(payload: JWTPayload): Promise<boolean> {
  if (!getBridgeDeadline()) return false;
  if (payload.sessionId === undefined) return false;
  return legacyBridgeCached(payload.sessionId, payload.userId);
}

/** Cabut semua sesi lama user (nonaktif/reset): jembatan tidak boleh menghidupkan akses yang dicabut. */
export async function revokeLegacySessionsForUser(userId: number, reason: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
}
