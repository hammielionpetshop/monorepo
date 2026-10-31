import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Sql, TransactionSql } from 'postgres';

export type AppCode = 'backoffice' | 'hris';
export type BackofficePolicy = { role: string; ttlMs: number };
export type AuthFailure = { ok: false; code: string; error: string };
export type AuthResult<T> = ({ ok: true } & T) | AuthFailure;
type LoginSuccess = { token: string; sessionId: number; mustChangePassword: boolean };
type SessionIdentity = { sessionId: number; accountId: number; localUserId: number };
type PreviousSession = { id: number; accountId: number } | null;
type LoginInput = {
  appCode: AppCode;
  backoffice?: BackofficePolicy;
  previousToken?: string;
  deviceLabel?: string;
};
export const HRIS_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
export const ONBOARDING_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;
const dummyHash = argon2.hash(randomBytes(32));

export function failure(code = 'INVALID_CREDENTIALS'): AuthFailure {
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: 'Login tidak berhasil. Periksa kredensial atau coba kembali nanti.',
    INVALID_SESSION: 'Sesi tidak valid, silakan login kembali.',
    PASSWORD_REQUIRED: 'Masuk dengan password untuk membuka HRIS.',
    PASSWORD_CHANGE_REQUIRED: 'Ganti password awal sebelum membuka aplikasi.',
    APP_ACCESS_DENIED: 'Akun belum memiliki tautan akses ke aplikasi ini.',
    ACCESS_EXPIRED: 'Akses berakhir, silakan login kembali.',
  };
  return { ok: false, code, error: messages[code] ?? 'Permintaan tidak dapat diproses.' };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function lockAccounts(tx: TransactionSql, ids: number[]): Promise<void> {
  const ordered = [...new Set(ids)].sort((a, b) => a - b);
  if (ordered.length) await tx`select id from auth.accounts where id in ${tx(ordered)} order by id for update`;
}

export async function databaseNow(tx: TransactionSql): Promise<Date> {
  const [row] = await tx`select clock_timestamp() as now`;
  return new Date(row.now);
}

export async function audit(tx: TransactionSql, accountId: number, actorAccountId: number | null,
  action: string, metadata: Record<string, string | number | boolean | null>, description: string): Promise<void> {
  await tx`insert into auth.audit_events (account_id, actor_account_id, action, metadata, description)
    values (${accountId}, ${actorAccountId}, ${action}, ${JSON.stringify(metadata)}::text::jsonb, ${description})`;
}

async function loginEvent(tx: TransactionSql, accountId: number | null, appCode: AppCode,
  method: string, outcome: string, deviceLabel?: string): Promise<void> {
  await tx`insert into auth.login_events (account_id, app_code, auth_method, outcome, device_label)
    values (${accountId}, ${appCode}, ${method}, ${outcome}, ${deviceLabel?.slice(0, 200) ?? null})`;
}

export function appTtl(appCode: AppCode, policy?: BackofficePolicy): number {
  if (appCode === 'hris') return HRIS_IDLE_MS;
  if (appCode !== 'backoffice' || !policy || typeof policy.role !== 'string' || !policy.role.trim()
    || !Number.isSafeInteger(policy.ttlMs) || policy.ttlMs <= 0 || policy.ttlMs > HRIS_IDLE_MS) {
    throw new Error('Kebijakan akses backoffice wajib diisi secara eksplisit, maksimal 30 hari.');
  }
  return policy.ttlMs;
}

async function previousSession(tx: TransactionSql, token?: string): Promise<PreviousSession> {
  if (!validToken(token)) return null;
  const [row] = await tx`select id, account_id from auth.sessions where token_hash = ${hashSessionToken(token)}`;
  return row ? { id: row.id, accountId: row.account_id } : null;
}

async function revokePrevious(tx: TransactionSql, previous: PreviousSession, now: Date): Promise<void> {
  if (!previous) return;
  const rows = await tx`update auth.sessions set revoked_at = ${now.toISOString()}, revoked_reason = 'ACCOUNT_SWITCH'
    where id = ${previous.id} and account_id = ${previous.accountId} and revoked_at is null returning account_id, id`;
  for (const row of rows) await audit(tx, row.account_id, row.account_id, 'ACCOUNT_SWITCH',
      { sessionId: row.id, beforeRevoked: false, afterRevoked: true }, 'Konteks browser sebelumnya dicabut saat login baru.');
}

async function touchHris(tx: TransactionSql, sessionId: number, now: Date): Promise<void> {
  const expiresAt = new Date(now.getTime() + HRIS_IDLE_MS).toISOString();
  await tx`update auth.session_app_access set last_active_at = ${now.toISOString()}, expires_at = ${expiresAt}
    where session_id = ${sessionId} and app_code = 'hris'`;
  await tx`update auth.sessions set expires_at = greatest(expires_at, ${expiresAt}) where id = ${sessionId}`;
}

async function grantApp(tx: TransactionSql, sessionId: number, accountId: number, appCode: AppCode,
  now: Date, policy?: BackofficePolicy): Promise<AuthResult<{ localUserId: number }>> {
  const ttl = appTtl(appCode, policy);
  const [link] = await tx`select id, local_user_id from auth.account_links
    where account_id = ${accountId} and app_code = ${appCode} and revoked_at is null`;
  if (!link) return failure('APP_ACCESS_DENIED');
  const [existing] = await tx`select * from auth.session_app_access
    where session_id = ${sessionId} and app_code = ${appCode}`;
  if (existing) {
    if (existing.revoked_at || new Date(existing.expires_at) <= now || existing.account_link_id !== link.id
      || existing.local_user_id !== link.local_user_id) return failure('ACCESS_EXPIRED');
    if (appCode === 'hris') await touchHris(tx, sessionId, now);
    return { ok: true, localUserId: link.local_user_id };
  }
  if (appCode === 'backoffice' && policy?.role !== 'OWNER') {
    const revoked = await tx`update auth.session_app_access set revoked_at = ${now.toISOString()}, revoked_reason = 'TAKEN_OVER'
      where app_code = 'backoffice' and revoked_at is null and session_id <> ${sessionId}
        and session_id in (select id from auth.sessions where account_id = ${accountId}) returning session_id`;
    for (const row of revoked) await audit(tx, accountId, accountId, 'TAKEN_OVER',
      { sessionId: row.session_id, beforeRevoked: false, afterRevoked: true }, 'Akses backoffice diambil alih perangkat lain.');
  }
  await tx`insert into auth.session_app_access
    (session_id, app_code, account_link_id, local_user_id, last_active_at, expires_at)
    values (${sessionId}, ${appCode}, ${link.id}, ${link.local_user_id}, ${now.toISOString()}, ${new Date(now.getTime() + ttl).toISOString()})`;
  if (appCode === 'hris') await touchHris(tx, sessionId, now);
  return { ok: true, localUserId: link.local_user_id };
}

async function createSession(tx: TransactionSql, accountId: number, method: 'PASSWORD' | 'PIN',
  mustChangePassword: boolean, input: LoginInput, now: Date, previous: PreviousSession): Promise<AuthResult<LoginSuccess>> {
  const ttl = appTtl(input.appCode, input.backoffice);
  if (!mustChangePassword) {
    const links = await tx`select id from auth.account_links where account_id = ${accountId}
      and app_code = ${input.appCode} and revoked_at is null`;
    if (!links.length) return failure('APP_ACCESS_DENIED');
  }
  await revokePrevious(tx, previous, now);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + (mustChangePassword ? ONBOARDING_MS : method === 'PASSWORD' ? HRIS_IDLE_MS : ttl));
  const [session] = await tx`insert into auth.sessions
    (account_id, token_hash, auth_method, device_label, created_at, expires_at)
    values (${accountId}, ${hashSessionToken(token)}, ${method}, ${input.deviceLabel?.slice(0, 200) ?? null}, ${now.toISOString()}, ${expiresAt.toISOString()})
    returning id`;
  if (!mustChangePassword) {
    const access = await grantApp(tx, session.id, accountId, input.appCode, now, input.backoffice);
    if (!access.ok) throw new Error('Tautan akses berubah selama pembuatan sesi.');
  }
  await audit(tx, accountId, accountId, 'LOGIN', { sessionId: session.id, method }, 'Sesi perangkat dibuat.');
  return { ok: true, token, sessionId: session.id, mustChangePassword };
}

export async function passwordLogin(sql: Sql, input: LoginInput & { identifier: string; password: string }): Promise<AuthResult<LoginSuccess>> {
  appTtl(input.appCode, input.backoffice);
  const identifier = typeof input.identifier === 'string' ? input.identifier.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (identifier.length > 255 || password.length > 1024) return failure();
  return await sql.begin(async (tx) => {
    const matches = identifier ? await tx`select id from auth.accounts where username = ${identifier} or email = ${identifier}` : [];
    const previous = await previousSession(tx, input.previousToken);
    await lockAccounts(tx, [...matches.map((row) => row.id), ...(previous ? [previous.accountId] : [])]);
    const [account] = matches.length === 1
      ? await tx`select * from auth.accounts where id = ${matches[0].id} and (username = ${identifier} or email = ${identifier})` : [];
    const now = await databaseNow(tx);
    let passwordMatches = false;
    try { passwordMatches = await argon2.verify(account?.password_hash ?? await dummyHash, password); }
    catch { await argon2.verify(await dummyHash, password); }
    if (!account || !account.is_active || (account.locked_until && new Date(account.locked_until) > now)) {
      await loginEvent(tx, account?.id ?? null, input.appCode, 'PASSWORD', 'REJECTED', input.deviceLabel);
      return failure();
    }
    if (!passwordMatches || !account.password_hash) {
      const count = account.locked_until ? 1 : Math.min(account.failed_login_count + 1, 5);
      await tx`update auth.accounts set failed_login_count = ${count},
        locked_until = ${count === 5 ? new Date(now.getTime() + LOCK_MS).toISOString() : null} where id = ${account.id}`;
      await loginEvent(tx, account.id, input.appCode, 'PASSWORD', 'REJECTED', input.deviceLabel);
      return failure();
    }
    await tx`update auth.accounts set failed_login_count = 0, locked_until = null where id = ${account.id}`;
    const result = await createSession(tx, account.id, 'PASSWORD', account.must_change_password, input, now, previous);
    await loginEvent(tx, account.id, input.appCode, 'PASSWORD', result.ok ? 'SUCCESS' : 'REJECTED', input.deviceLabel);
    return result;
  });
}

// Hanya adapter server BO yang boleh memanggil sesudah memverifikasi PIN serta role lokal.
export async function startVerifiedPinSession(sql: Sql, input: Omit<LoginInput, 'appCode'> & {
  accountId: number; localUserId: number; backoffice: BackofficePolicy;
}): Promise<AuthResult<LoginSuccess>> {
  appTtl('backoffice', input.backoffice);
  return await sql.begin(async (tx) => {
    const previous = await previousSession(tx, input.previousToken);
    await lockAccounts(tx, [input.accountId, ...(previous ? [previous.accountId] : [])]);
    const [account] = await tx`select a.* from auth.accounts a join auth.account_links l on l.account_id = a.id
      where a.id = ${input.accountId} and l.app_code = 'backoffice' and l.local_user_id = ${input.localUserId}
      and l.revoked_at is null`;
    if (!account?.is_active || (account.password_hash && account.must_change_password)) {
      await loginEvent(tx, account?.id ?? null, 'backoffice', 'PIN', 'REJECTED', input.deviceLabel);
      return account?.is_active ? failure('PASSWORD_CHANGE_REQUIRED') : failure();
    }
    // PIN-only warisan tetap berjalan; kewajiban password tidak boleh diakali untuk HRIS.
    const result = await createSession(tx, account.id, 'PIN', false, { ...input, appCode: 'backoffice' }, await databaseNow(tx), previous);
    await loginEvent(tx, account.id, 'backoffice', 'PIN', result.ok ? 'SUCCESS' : 'REJECTED', input.deviceLabel);
    return result;
  });
}

export async function lockedSession(tx: TransactionSql, token: string) {
  if (!validToken(token)) return null;
  const [identity] = await tx`select account_id from auth.sessions where token_hash = ${hashSessionToken(token)}`;
  if (!identity) return null;
  await lockAccounts(tx, [identity.account_id]);
  const [row] = await tx`select s.*, a.is_active, a.must_change_password from auth.sessions s
    join auth.accounts a on a.id = s.account_id where s.token_hash = ${hashSessionToken(token)}`;
  const now = await databaseNow(tx);
  if (!row || !row.is_active || row.revoked_at || new Date(row.expires_at) <= now) return null;
  return { row, now };
}

export async function openAppAccess(sql: Sql, token: string, appCode: AppCode,
  backoffice?: BackofficePolicy): Promise<AuthResult<SessionIdentity>> {
  appTtl(appCode, backoffice);
  return await sql.begin(async (tx) => {
    const context = await lockedSession(tx, token);
    if (!context) return failure('INVALID_SESSION');
    const { row, now } = context;
    if (appCode === 'hris' && row.auth_method !== 'PASSWORD') return failure('PASSWORD_REQUIRED');
    if (row.must_change_password && row.auth_method === 'PASSWORD') return failure('PASSWORD_CHANGE_REQUIRED');
    const result = await grantApp(tx, row.id, row.account_id, appCode, now, backoffice);
    return result.ok ? { ok: true, sessionId: row.id, accountId: row.account_id, localUserId: result.localUserId } : result;
  });
}

export async function validateSession(sql: Sql, token: string, appCode: AppCode): Promise<AuthResult<SessionIdentity>> {
  if (appCode !== 'hris' && appCode !== 'backoffice') return failure('APP_ACCESS_DENIED');
  return await sql.begin(async (tx) => {
    const context = await lockedSession(tx, token);
    if (!context) return failure('INVALID_SESSION');
    const { row, now } = context;
    if (appCode === 'hris' && row.auth_method !== 'PASSWORD') return failure('PASSWORD_REQUIRED');
    if (row.must_change_password && row.auth_method === 'PASSWORD') return failure('PASSWORD_CHANGE_REQUIRED');
    const [access] = await tx`select x.* from auth.session_app_access x join auth.account_links l on l.id = x.account_link_id
      where x.session_id = ${row.id} and x.app_code = ${appCode} and l.account_id = ${row.account_id}
      and l.app_code = x.app_code and l.local_user_id = x.local_user_id and l.revoked_at is null`;
    if (!access || access.revoked_at || new Date(access.expires_at) <= now) return failure('ACCESS_EXPIRED');
    if (appCode === 'hris') {
      await touchHris(tx, row.id, now);
    } else await tx`update auth.session_app_access set last_active_at = ${now.toISOString()} where id = ${access.id}`;
    return { ok: true, sessionId: row.id, accountId: row.account_id, localUserId: access.local_user_id };
  });
}

export async function logoutSession(sql: Sql, token: string): Promise<void> {
  await sql.begin(async (tx) => {
    if (!validToken(token)) return;
    const [session] = await tx`select id, account_id from auth.sessions where token_hash = ${hashSessionToken(token)}`;
    if (!session) return;
    await lockAccounts(tx, [session.account_id]);
    const rows = await tx`update auth.sessions set revoked_at = ${(await databaseNow(tx)).toISOString()}, revoked_reason = 'LOGOUT'
      where id = ${session.id} and token_hash = ${hashSessionToken(token)} and revoked_at is null returning id`;
    if (rows.length) await audit(tx, session.account_id, session.account_id, 'LOGOUT',
      { sessionId: session.id, beforeRevoked: false, afterRevoked: true }, 'Seluruh akses sesi perangkat dicabut.');
  });
}
