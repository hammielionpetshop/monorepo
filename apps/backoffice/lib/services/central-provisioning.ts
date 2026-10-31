import { provisionBackofficeAccount } from '@petshop/auth';
import { db, users, eq } from '@/lib/db';
import { getAuthSql } from '@/lib/central-auth';

type Provision = { userId: number; idempotencyKey: string; actorAccountId: number | null };
export type ProvisionOutcome =
  | { ok: true; accountId: number; created: boolean }
  | { ok: false; status: 400 | 404 | 409; error: string };

/**
 * Menjamin user backoffice punya akun pusat + tautan. Satu-satunya jalur penulisan akun dari
 * UI Pengguna maupun pintu internal. Hash password disalin dari tabel users, tidak dibuat baru.
 */
export async function provisionUserAccount(input: Provision): Promise<ProvisionOutcome> {
  const [user] = await db.select({
    id: users.id, username: users.username, email: users.email, passwordHash: users.passwordHash,
    isActive: users.isActive, mustChangeCredentials: users.mustChangeCredentials,
  }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) return { ok: false, status: 404, error: 'Pengguna tidak ditemukan.' };

  const result = await provisionBackofficeAccount(getAuthSql(), {
    idempotencyKey: input.idempotencyKey,
    localUserId: user.id,
    username: user.username,
    email: user.email,
    passwordHash: user.passwordHash,
    mustChangePassword: user.mustChangeCredentials,
    isActive: user.isActive,
    actorAccountId: input.actorAccountId,
  });
  if (result.ok) return { ok: true, accountId: result.accountId, created: result.created };
  const status = result.code === 'INVALID_REQUEST' ? 400 : 409;
  return { ok: false, status, error: result.error };
}
