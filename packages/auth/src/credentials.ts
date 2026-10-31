import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Sql, TransactionSql } from 'postgres';
import { HRIS_IDLE_MS, audit, databaseNow, failure, hashSessionToken, lockAccounts, lockedSession, validToken } from './sessions';
import type { AuthResult } from './sessions';

type Actor = { token: string; role: 'OWNER' | 'GM' };

function validateNewPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
    throw new Error('Password baru harus berisi 8 sampai 1024 karakter.');
  }
}

async function revokeAll(tx: TransactionSql, accountId: number, reason: string, now: Date): Promise<void> {
  await tx`update auth.sessions set revoked_at = ${now.toISOString()}, revoked_reason = ${reason}
    where account_id = ${accountId} and revoked_at is null`;
}

// Role pelaku wajib berasal dari hak lokal yang sudah diverifikasi adapter server.
async function authorizeActor(tx: TransactionSql, accountId: number, actor: Actor) {
  if (!actor || !['OWNER', 'GM'].includes(actor.role) || !validToken(actor.token)) return null;
  const [identity] = await tx`select account_id from auth.sessions where token_hash = ${hashSessionToken(actor.token)}`;
  if (!identity) return null;
  await lockAccounts(tx, [accountId, identity.account_id]);
  const context = await lockedSession(tx, actor.token);
  if (!context || (context.row.must_change_password && context.row.auth_method === 'PASSWORD')) return null;
  const [access] = await tx`select x.id from auth.session_app_access x join auth.account_links l on l.id = x.account_link_id
    where x.session_id = ${context.row.id} and x.app_code = 'backoffice' and x.revoked_at is null
    and x.expires_at > ${context.now.toISOString()} and l.revoked_at is null and l.account_id = ${identity.account_id}
    and l.app_code = 'backoffice' and l.local_user_id = x.local_user_id`;
  return access ? context : null;
}

export async function changePassword(sql: Sql, input: {
  token: string; currentPassword: string; newPassword: string; revokeOtherSessions: boolean;
}): Promise<AuthResult<{ token: string }>> {
  validateNewPassword(input.newPassword);
  if (typeof input.revokeOtherSessions !== 'boolean') throw new Error('Kebijakan pencabutan sesi lain wajib diisi.');
  if (typeof input.currentPassword !== 'string' || input.currentPassword.length > 1024) return failure();
  return await sql.begin(async (tx) => {
    const context = await lockedSession(tx, input.token);
    if (!context || context.row.auth_method !== 'PASSWORD') return failure('INVALID_SESSION');
    const { row } = context;
    const [account] = await tx`select * from auth.accounts where id = ${row.account_id}`;
    const now = await databaseNow(tx);
    if (account.locked_until && new Date(account.locked_until) > now) return failure();
    let matches = false;
    try { matches = !!account.password_hash && await argon2.verify(account.password_hash, input.currentPassword); }
    catch { return failure(); }
    if (!matches) {
      const count = account.locked_until ? 1 : Math.min(account.failed_login_count + 1, 5);
      await tx`update auth.accounts set failed_login_count = ${count},
        locked_until = ${count === 5 ? new Date(now.getTime() + 300_000).toISOString() : null} where id = ${account.id}`;
      return failure();
    }
    const passwordHash = await argon2.hash(input.newPassword);
    await tx`update auth.accounts set password_hash = ${passwordHash}, must_change_password = false,
      failed_login_count = 0, locked_until = null, credentials_changed_at = ${now.toISOString()}, updated_at = ${now.toISOString()} where id = ${account.id}`;
    const revokeOtherSessions = !!account.must_change_password || input.revokeOtherSessions;
    if (revokeOtherSessions) await tx`update auth.sessions set revoked_at = ${now.toISOString()}, revoked_reason = 'PASSWORD_CHANGED'
      where account_id = ${account.id} and id <> ${row.id} and revoked_at is null`;
    const token = randomBytes(32).toString('base64url');
    await tx`update auth.sessions set token_hash = ${hashSessionToken(token)}, expires_at = ${new Date(now.getTime() + HRIS_IDLE_MS).toISOString()}
      where id = ${row.id}`;
    await audit(tx, account.id, account.id, 'PASSWORD_CHANGED', {
      beforeMustChangePassword: account.must_change_password, afterMustChangePassword: false,
      otherSessionsRevoked: revokeOtherSessions, sessionId: row.id,
    }, 'Password diganti dan token sesi dirotasi.');
    return { ok: true, token };
  });
}

export async function resetPassword(sql: Sql, input: {
  accountId: number; newPassword: string; actor: Actor;
}): Promise<AuthResult<Record<never, never>>> {
  validateNewPassword(input.newPassword);
  return await sql.begin(async (tx) => {
    const context = await authorizeActor(tx, input.accountId, input.actor);
    if (!context) return failure('APP_ACCESS_DENIED');
    const [account] = await tx`select * from auth.accounts where id = ${input.accountId}`;
    if (!account) return failure('APP_ACCESS_DENIED');
    const now = await databaseNow(tx);
    await tx`update auth.accounts set password_hash = ${await argon2.hash(input.newPassword)}, must_change_password = true,
      failed_login_count = 0, locked_until = null, credentials_changed_at = ${now.toISOString()}, updated_at = ${now.toISOString()} where id = ${account.id}`;
    await revokeAll(tx, account.id, 'PASSWORD_RESET', now);
    await audit(tx, account.id, context.row.account_id, 'PASSWORD_RESET', {
      beforeMustChangePassword: account.must_change_password, afterMustChangePassword: true, allSessionsRevoked: true,
    }, 'Password direset oleh pelaku berhak; semua sesi akun dicabut.');
    return { ok: true };
  });
}

export async function deactivateAccount(sql: Sql, input: {
  accountId: number; actor: Actor;
}): Promise<AuthResult<Record<never, never>>> {
  return await sql.begin(async (tx) => {
    const context = await authorizeActor(tx, input.accountId, input.actor);
    if (!context) return failure('APP_ACCESS_DENIED');
    const [account] = await tx`select is_active from auth.accounts where id = ${input.accountId}`;
    if (!account) return failure('APP_ACCESS_DENIED');
    const now = await databaseNow(tx);
    await tx`update auth.accounts set is_active = false, updated_at = ${now.toISOString()} where id = ${input.accountId}`;
    await revokeAll(tx, input.accountId, 'ACCOUNT_DISABLED', now);
    await audit(tx, input.accountId, context.row.account_id, 'ACCOUNT_DISABLED',
      { beforeIsActive: account.is_active, afterIsActive: false, allSessionsRevoked: true }, 'Akun dinonaktifkan dan seluruh sesi dicabut.');
    return { ok: true };
  });
}

export async function revokeAccountLink(sql: Sql, input: {
  accountId: number; appCode: 'backoffice' | 'hris'; actor: Actor;
}): Promise<AuthResult<Record<never, never>>> {
  if (!['backoffice', 'hris'].includes(input.appCode)) return failure('APP_ACCESS_DENIED');
  return await sql.begin(async (tx) => {
    const context = await authorizeActor(tx, input.accountId, input.actor);
    if (!context) return failure('APP_ACCESS_DENIED');
    const now = await databaseNow(tx);
    const [link] = await tx`update auth.account_links set revoked_at = ${now.toISOString()}
      where account_id = ${input.accountId} and app_code = ${input.appCode} and revoked_at is null returning id, local_user_id`;
    if (!link) return failure('APP_ACCESS_DENIED');
    await tx`update auth.session_app_access set revoked_at = ${now.toISOString()}, revoked_reason = 'LINK_REVOKED'
      where account_link_id = ${link.id} and revoked_at is null`;
    await audit(tx, input.accountId, context.row.account_id, 'LINK_REVOKED', {
      appCode: input.appCode, localUserId: link.local_user_id, beforeLinked: true, afterLinked: false,
    }, 'Tautan dan seluruh akses terkait dicabut.');
    return { ok: true };
  });
}
