import { createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Sql, TransactionSql } from 'postgres';
import { audit, databaseNow, failure, lockAccounts } from './sessions';
import type { AuthResult } from './sessions';

/*
 * Kelola akun dari HRIS (spec L2d §3). Semua fungsi di sini dipanggil oleh pemanggil tepercaya —
 * route HRIS sesudah `can()` lolos, atau pintu internal backoffice sesudah pagarnya — seperti
 * `setHrisLinkedAccountActive`. `actorAccountId` dicatat di audit; tindakan atas akun sendiri ditolak.
 */

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function normalizeEmail(value: unknown): string | null {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return email && email.length <= 255 && EMAIL_PATTERN.test(email) ? email : null;
}

function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 1024;
}

type LinkOutcome = { ok: true; changed: boolean } | { ok: false; code: string };

/**
 * Memasang tautan `hris` akun → karyawan. Baris tautan yang pernah dicabut dipakai ulang (indeks unik
 * per akun dan per karyawan), supaya salah tautan bisa dibetulkan: lepas lalu tautkan ke akun yang benar.
 */
async function attachHrisLink(tx: TransactionSql, accountId: number, employeeId: number): Promise<LinkOutcome> {
  const rows = await tx`select id, account_id, local_user_id, revoked_at from auth.account_links
    where app_code = 'hris' and (account_id = ${accountId} or local_user_id = ${employeeId}) for update`;
  const byEmployee = rows.find((row) => row.local_user_id === employeeId);
  const byAccount = rows.find((row) => row.account_id === accountId);
  if (byEmployee && !byEmployee.revoked_at) {
    return byEmployee.account_id === accountId ? { ok: true, changed: false } : { ok: false, code: 'LINK_CONFLICT' };
  }
  if (byAccount && !byAccount.revoked_at) return { ok: false, code: 'LINK_CONFLICT' };
  if (byEmployee && byAccount && byEmployee.id !== byAccount.id) return { ok: false, code: 'LINK_CONFLICT' };
  const reuse = byEmployee ?? byAccount;
  if (reuse) {
    await tx`update auth.account_links set account_id = ${accountId}, local_user_id = ${employeeId}, revoked_at = null
      where id = ${reuse.id}`;
  } else {
    await tx`insert into auth.account_links (account_id, app_code, local_user_id) values (${accountId}, 'hris', ${employeeId})`;
  }
  return { ok: true, changed: true };
}

/**
 * Akun baru untuk karyawan: email asli + password awal, wajib ganti saat masuk pertama (KAR-69, PRD 04 §3.1).
 * Aman diulang dengan kunci yang sama; karyawan yang sudah bertaut mengembalikan akunnya.
 */
export async function provisionHrisAccount(sql: Sql, input: {
  idempotencyKey: string; employeeId: number; email: string; initialPassword: string; actorAccountId: number;
}): Promise<AuthResult<{ accountId: number; created: boolean }>> {
  const email = normalizeEmail(input.email);
  if (!KEY_PATTERN.test(input.idempotencyKey) || !positiveId(input.employeeId) || !positiveId(input.actorAccountId)
    || !email || !validPassword(input.initialPassword)) return failure('INVALID_REQUEST');
  const requestHash = createHash('sha256').update(JSON.stringify(['hris', input.employeeId, email])).digest('hex');
  const passwordHash = await argon2.hash(input.initialPassword);

  return await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('auth.provision.hris'), ${input.employeeId})`;
    const inserted = await tx`insert into auth.provisioning_requests
      (idempotency_key, request_hash, app_code, local_user_id, actor_account_id)
      values (${input.idempotencyKey}, ${requestHash}, 'hris', ${input.employeeId}, ${input.actorAccountId})
      on conflict (idempotency_key) do nothing returning id`;
    const [request] = inserted.length ? inserted : await tx`select id, request_hash, account_id
      from auth.provisioning_requests where idempotency_key = ${input.idempotencyKey}`;
    if (!inserted.length && request.request_hash !== requestHash) return failure('IDEMPOTENCY_CONFLICT');
    if (!inserted.length && request.account_id) return { ok: true, accountId: request.account_id, created: false };

    const [linked] = await tx`select account_id from auth.account_links
      where app_code = 'hris' and local_user_id = ${input.employeeId} and revoked_at is null`;
    if (linked) return failure('LINK_CONFLICT');
    const [taken] = await tx`select id from auth.accounts where email = ${email} or username = ${email}`;
    if (taken) return failure('EMAIL_TAKEN');

    const [account] = await tx`insert into auth.accounts (email, password_hash, is_active, must_change_password)
      values (${email}, ${passwordHash}, true, true) returning id`;
    const link = await attachHrisLink(tx, account.id, input.employeeId);
    if (!link.ok) throw new Error('Tautan HRIS bentrok saat membuat akun baru.');
    await tx`update auth.provisioning_requests set account_id = ${account.id}, completed_at = now() where id = ${request.id}`;
    await audit(tx, account.id, input.actorAccountId, 'ACCOUNT_PROVISIONED',
      { appCode: 'hris', localUserId: input.employeeId, createdAccount: true },
      'Akun pusat dan tautan HRIS dibuat dari HRIS; password awal wajib diganti.');
    return { ok: true, accountId: account.id, created: true };
  });
}

/** Menautkan akun yang sudah ada (mis. pengguna backoffice lama hasil backfill) ke karyawan. */
export async function linkExistingAccountToEmployee(sql: Sql, input: {
  accountId: number; employeeId: number; actorAccountId: number;
}): Promise<AuthResult<{ changed: boolean }>> {
  if (!positiveId(input.accountId) || !positiveId(input.employeeId) || !positiveId(input.actorAccountId)) {
    return failure('INVALID_REQUEST');
  }
  if (input.accountId === input.actorAccountId) return failure('SELF_FORBIDDEN');
  return await sql.begin(async (tx) => {
    await lockAccounts(tx, [input.accountId]);
    const [account] = await tx`select id from auth.accounts where id = ${input.accountId}`;
    if (!account) return failure('NOT_FOUND');
    const link = await attachHrisLink(tx, input.accountId, input.employeeId);
    if (!link.ok) return failure(link.code);
    if (link.changed) {
      await audit(tx, input.accountId, input.actorAccountId, 'LINK_CREATED',
        { appCode: 'hris', localUserId: input.employeeId, beforeLinked: false, afterLinked: true },
        'Akun yang sudah ada ditautkan ke karyawan HRIS.');
    }
    return { ok: true, changed: link.changed };
  });
}

/** Melepas tautan HRIS karyawan; akses sesi HRIS-nya ikut dicabut. Akun dan tautan backoffice tetap. */
export async function unlinkEmployeeAccount(sql: Sql, input: {
  employeeId: number; actorAccountId: number; reason: string;
}): Promise<AuthResult<{ accountId: number }>> {
  if (!positiveId(input.employeeId) || !positiveId(input.actorAccountId)) return failure('INVALID_REQUEST');
  return await sql.begin(async (tx) => {
    const [found] = await tx`select account_id from auth.account_links
      where app_code = 'hris' and local_user_id = ${input.employeeId} and revoked_at is null`;
    if (!found) return failure('NOT_FOUND');
    if (found.account_id === input.actorAccountId) return failure('SELF_FORBIDDEN');
    await lockAccounts(tx, [found.account_id]);
    const now = await databaseNow(tx);
    const [link] = await tx`update auth.account_links set revoked_at = ${now.toISOString()}
      where app_code = 'hris' and local_user_id = ${input.employeeId} and revoked_at is null returning id`;
    if (!link) return failure('NOT_FOUND');
    await tx`update auth.session_app_access set revoked_at = ${now.toISOString()}, revoked_reason = 'LINK_REVOKED'
      where account_link_id = ${link.id} and revoked_at is null`;
    await audit(tx, found.account_id, input.actorAccountId, 'LINK_REVOKED', {
      appCode: 'hris', localUserId: input.employeeId, beforeLinked: true, afterLinked: false,
    }, `Tautan HRIS dilepas: ${input.reason.slice(0, 200)}`);
    return { ok: true, accountId: found.account_id };
  });
}

/** Reset password oleh Pemilik/GM: wajib ganti saat masuk berikutnya, semua sesi dicabut. */
export async function resetPasswordByTrustedCaller(sql: Sql, input: {
  accountId: number; newPassword: string; actorAccountId: number;
}): Promise<AuthResult<Record<never, never>>> {
  if (!positiveId(input.accountId) || !positiveId(input.actorAccountId) || !validPassword(input.newPassword)) {
    return failure('INVALID_REQUEST');
  }
  if (input.accountId === input.actorAccountId) return failure('SELF_FORBIDDEN');
  const passwordHash = await argon2.hash(input.newPassword);
  return await sql.begin(async (tx) => {
    await lockAccounts(tx, [input.accountId]);
    const [account] = await tx`select must_change_password from auth.accounts where id = ${input.accountId}`;
    if (!account) return failure('NOT_FOUND');
    const now = await databaseNow(tx);
    await tx`update auth.accounts set password_hash = ${passwordHash}, must_change_password = true,
      failed_login_count = 0, locked_until = null, credentials_changed_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
      where id = ${input.accountId}`;
    await tx`update auth.sessions set revoked_at = ${now.toISOString()}, revoked_reason = 'PASSWORD_RESET'
      where account_id = ${input.accountId} and revoked_at is null`;
    await audit(tx, input.accountId, input.actorAccountId, 'PASSWORD_RESET', {
      beforeMustChangePassword: account.must_change_password, afterMustChangePassword: true, allSessionsRevoked: true, source: 'hris',
    }, 'Password direset dari HRIS; semua sesi akun dicabut.');
    return { ok: true };
  });
}

/**
 * Mengeluarkan akun dari semua perangkat. `exceptSessionId` dipakai pemilik akun sendiri
 * ("keluarkan perangkat lain"); untuk akun orang lain semua sesi dicabut dan diri sendiri ditolak.
 */
export async function revokeAccountSessions(sql: Sql, input: {
  accountId: number; actorAccountId: number; exceptSessionId?: number;
}): Promise<AuthResult<{ revoked: number }>> {
  if (!positiveId(input.accountId) || !positiveId(input.actorAccountId)
    || (input.exceptSessionId !== undefined && !positiveId(input.exceptSessionId))) return failure('INVALID_REQUEST');
  const own = input.accountId === input.actorAccountId;
  if (own !== (input.exceptSessionId !== undefined)) return failure(own ? 'SELF_FORBIDDEN' : 'INVALID_REQUEST');
  return await sql.begin(async (tx) => {
    await lockAccounts(tx, [input.accountId]);
    const now = await databaseNow(tx);
    const rows = await tx`update auth.sessions set revoked_at = ${now.toISOString()}, revoked_reason = 'REVOKED_BY_USER'
      where account_id = ${input.accountId} and revoked_at is null and expires_at > ${now.toISOString()}
      and id <> ${input.exceptSessionId ?? 0} returning id`;
    if (rows.length) {
      await audit(tx, input.accountId, input.actorAccountId, 'SESSIONS_REVOKED',
        { revoked: rows.length, keptCurrentSession: own, source: 'hris' },
        own ? 'Pemilik akun mengeluarkan perangkat lain.' : 'Akun dikeluarkan dari semua perangkat.');
    }
    return { ok: true, revoked: rows.length };
  });
}

/**
 * Tautan backoffice untuk pengguna kasir baru milik akun yang sudah ada (pintu internal L2d).
 * Berbeda dari `provisionBackofficeAccount`, yang membuat akun dari data pengguna backoffice.
 */
export async function linkBackofficeUser(sql: Sql, input: {
  accountId: number; localUserId: number; actorAccountId: number;
}): Promise<AuthResult<{ changed: boolean }>> {
  if (!positiveId(input.accountId) || !positiveId(input.localUserId) || !positiveId(input.actorAccountId)) {
    return failure('INVALID_REQUEST');
  }
  return await sql.begin(async (tx): Promise<AuthResult<{ changed: boolean }>> => {
    await lockAccounts(tx, [input.accountId]);
    const rows = await tx`select account_id, local_user_id, revoked_at from auth.account_links
      where app_code = 'backoffice' and (account_id = ${input.accountId} or local_user_id = ${input.localUserId})`;
    const same = rows.find((row) => row.account_id === input.accountId && row.local_user_id === input.localUserId);
    if (same && !same.revoked_at) return { ok: true, changed: false };
    if (rows.length) return failure('LINK_CONFLICT');
    await tx`insert into auth.account_links (account_id, app_code, local_user_id)
      values (${input.accountId}, 'backoffice', ${input.localUserId})`;
    await audit(tx, input.accountId, input.actorAccountId, 'LINK_CREATED',
      { appCode: 'backoffice', localUserId: input.localUserId, beforeLinked: false, afterLinked: true },
      'Pengguna kasir dibuat dari HRIS dan ditautkan ke akun pusat.');
    return { ok: true, changed: true };
  });
}

/** Pengguna backoffice yang bertaut aktif ke akun, atau null. */
export async function findBackofficeUserOfAccount(sql: Sql, accountId: number): Promise<number | null> {
  if (!positiveId(accountId)) return null;
  const [link] = await sql`select local_user_id from auth.account_links
    where account_id = ${accountId} and app_code = 'backoffice' and revoked_at is null`;
  return link ? Number(link.local_user_id) : null;
}

export type AccountOverview = {
  accountId: number;
  username: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lockedUntil: Date | null;
  hrisEmployeeId: number | null;
  backofficeUserId: number | null;
  lastLoginAt: Date | null;
};

/** Daftar akun pusat beserta tautan aktifnya (layar Akun & Tautan). Tanpa rahasia. */
export async function listAccounts(sql: Sql, filter: { accountIds?: number[] } = {}): Promise<AccountOverview[]> {
  const ids = filter.accountIds?.filter(positiveId);
  if (ids && !ids.length) return [];
  const rows = await sql`select a.id, a.username, a.email, a.is_active, a.must_change_password, a.locked_until,
      h.local_user_id as hris_employee_id, b.local_user_id as backoffice_user_id,
      (select max(e.created_at) from auth.login_events e where e.account_id = a.id and e.outcome = 'SUCCESS') as last_login_at
    from auth.accounts a
    left join auth.account_links h on h.account_id = a.id and h.app_code = 'hris' and h.revoked_at is null
    left join auth.account_links b on b.account_id = a.id and b.app_code = 'backoffice' and b.revoked_at is null
    ${ids ? sql`where a.id in ${sql(ids)}` : sql``}
    order by coalesce(a.email, a.username), a.id`;
  return rows.map((row) => ({
    accountId: Number(row.id), username: row.username, email: row.email, isActive: row.is_active,
    mustChangePassword: row.must_change_password, lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
    hrisEmployeeId: row.hris_employee_id == null ? null : Number(row.hris_employee_id),
    backofficeUserId: row.backoffice_user_id == null ? null : Number(row.backoffice_user_id),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
  }));
}

/** Akun yang bertaut ke karyawan, atau null. */
export async function findEmployeeAccount(sql: Sql, employeeId: number): Promise<AccountOverview | null> {
  if (!positiveId(employeeId)) return null;
  const [link] = await sql`select account_id from auth.account_links
    where app_code = 'hris' and local_user_id = ${employeeId} and revoked_at is null`;
  if (!link) return null;
  const [account] = await listAccounts(sql, { accountIds: [Number(link.account_id)] });
  return account ?? null;
}

export type ActiveSession = {
  sessionId: number; deviceLabel: string | null; authMethod: string; createdAt: Date; apps: string[]; lastActiveAt: Date | null;
};

/** Perangkat yang sedang masuk (KAR-L14). */
export async function listActiveSessions(sql: Sql, accountId: number): Promise<ActiveSession[]> {
  if (!positiveId(accountId)) return [];
  const rows = await sql`select s.id, s.device_label, s.auth_method, s.created_at,
      coalesce(array_agg(distinct x.app_code) filter (where x.id is not null), '{}') as apps,
      max(x.last_active_at) as last_active_at
    from auth.sessions s
    left join auth.session_app_access x on x.session_id = s.id and x.revoked_at is null and x.expires_at > now()
    where s.account_id = ${accountId} and s.revoked_at is null and s.expires_at > now()
    group by s.id order by s.id desc`;
  return rows.map((row) => ({
    sessionId: Number(row.id), deviceLabel: row.device_label, authMethod: row.auth_method,
    createdAt: new Date(row.created_at), apps: row.apps as string[],
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : null,
  }));
}

export type LoginEventRow = {
  id: number; accountId: number | null; username: string | null; email: string | null;
  appCode: string; authMethod: string; outcome: string; deviceLabel: string | null; createdAt: Date;
};

/** Riwayat masuk (KAR-L14, L40), terbaru dulu; rentang `[from, to)`. */
export async function listLoginEvents(sql: Sql, input: {
  from: Date; to: Date; accountId?: number; outcome?: 'SUCCESS' | 'REJECTED'; limit: number; offset: number;
}): Promise<{ rows: LoginEventRow[]; total: number }> {
  const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 200);
  const offset = Math.max(Math.trunc(input.offset), 0);
  const where = sql`e.created_at >= ${input.from.toISOString()} and e.created_at < ${input.to.toISOString()}
    ${input.accountId ? sql`and e.account_id = ${input.accountId}` : sql``}
    ${input.outcome ? sql`and e.outcome = ${input.outcome}` : sql``}`;
  const [{ total }] = await sql`select count(*)::int as total from auth.login_events e where ${where}`;
  const rows = await sql`select e.id, e.account_id, a.username, a.email, e.app_code, e.auth_method, e.outcome,
      e.device_label, e.created_at
    from auth.login_events e left join auth.accounts a on a.id = e.account_id
    where ${where} order by e.id desc limit ${limit} offset ${offset}`;
  return {
    total: Number(total),
    rows: rows.map((row) => ({
      id: Number(row.id), accountId: row.account_id == null ? null : Number(row.account_id), username: row.username,
      email: row.email, appCode: row.app_code, authMethod: row.auth_method, outcome: row.outcome,
      deviceLabel: row.device_label, createdAt: new Date(row.created_at),
    })),
  };
}
