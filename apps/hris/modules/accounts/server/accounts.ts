import {
  findEmployeeAccount, linkExistingAccountToEmployee, listAccounts, listActiveSessions, listLoginEvents,
  provisionHrisAccount, resetPasswordByTrustedCaller, revokeAccountSessions, unlinkEmployeeAccount,
  type AccountOverview,
} from '@petshop/auth';
import { getAuthSql } from '@/lib/auth';
import { db } from '@/lib/db';
import { can, recordAudit, type Actor, type ServiceResult } from '@/modules/access';
import { getEmployeeBasic, listEmployeeBasics, todayWib, type EmployeeBasic } from '@/modules/employees';
import { checkReason, settingOn } from '@/modules/settings';
import {
  cleanKasirAccess, isValidEmail, loginRange, passwordProblem,
} from '../rules/accounts';
import { fetchKasirAccess, saveKasirAccess, type KasirAccessView, type KasirOptions } from './backoffice';

const fail = (status: 400 | 403 | 404 | 409 | 502, error: string) => ({ ok: false as const, status, error });

export type AccountView = {
  accountId: number;
  username: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
};

function toView(account: AccountOverview): AccountView {
  return {
    accountId: account.accountId, username: account.username, email: account.email, isActive: account.isActive,
    mustChangePassword: account.mustChangePassword, lockedUntil: account.lockedUntil?.toISOString() ?? null,
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
  };
}

const accountLabel = (account: AccountOverview) => account.email ?? account.username ?? `Akun #${account.accountId}`;

async function audit(actor: Actor, employeeId: number, action: string, after: unknown, reason: string | null = null) {
  await db.transaction((tx) => recordAudit(tx, {
    actorAccountId: actor.accountId, entity: 'account', entityId: employeeId, action, after, reason,
  }));
}

// ---------- Kartu Akun di Halaman orang ----------

/** Isi kartu Akun (spec L2d §6). Null bila pelaku tidak berhak melihat data orang ini. */
export async function getEmployeeAccountPanel(actor: Actor | null, employeeId: number) {
  const employee = await getEmployeeBasic(employeeId);
  if (!employee || !can(actor, 'profile.view', employee.target)) return null;
  const rights = {
    manage: can(actor, 'account.manage', employee.target),
    resetPassword: can(actor, 'account.reset_password', employee.target),
    revokeSessions: can(actor, 'sessions.revoke', employee.target),
    kasir: can(actor, 'backoffice_access.manage', employee.target),
  };
  const account = await findEmployeeAccount(getAuthSql(), employeeId);

  let kasir: { access: KasirAccessView | null; options: KasirOptions } | null = null;
  let kasirError: string | null = null;
  if (account && rights.kasir) {
    const result = await fetchKasirAccess([account.accountId]);
    if (result.ok) {
      kasir = {
        access: result.data.access[String(account.accountId)] ?? null,
        options: { roles: result.data.roles, branches: result.data.branches },
      };
    } else kasirError = result.error;
  }

  let linkCandidates: { accountId: number; label: string }[] = [];
  if (!account && rights.manage) {
    linkCandidates = (await listAccounts(getAuthSql()))
      .filter((a) => a.hrisEmployeeId === null)
      .map((a) => ({ accountId: a.accountId, label: accountLabel(a) }));
  }

  // Saran role kasir dari jabatan orang hari ini (KAR-L31, spec L2e §5); role tetap dipilih eksplisit.
  const suggestion = String(await settingOn('position.backoffice_role_suggestion', todayWib(), { positionId: employee.positionId }));

  return {
    employee: { id: employee.id, code: employee.code, name: employee.name, email: employee.email, activeToday: employee.activeToday, positionName: employee.positionName },
    suggestedRole: suggestion === 'NONE' ? null : suggestion,
    isSelf: actor?.personId === employeeId,
    rights,
    account: account ? toView(account) : null,
    kasir,
    kasirError,
    linkCandidates,
  };
}

export type EmployeeAccountPanel = NonNullable<Awaited<ReturnType<typeof getEmployeeAccountPanel>>>;

// ---------- Mutasi atas akun seorang karyawan ----------

async function activeEmployee(employeeId: number): Promise<EmployeeBasic | { error: ReturnType<typeof fail> }> {
  const employee = await getEmployeeBasic(employeeId);
  if (!employee) return { error: fail(404, 'Karyawan tidak ditemukan.') };
  if (!employee.activeToday) return { error: fail(409, 'Karyawan nonaktif: akunnya tidak bisa diubah.') };
  return employee;
}

export async function createAccount(actor: Actor, employeeId: number, input: { email: string; password: string }):
  Promise<ServiceResult<{ accountId: number }>> {
  const employee = await activeEmployee(employeeId);
  if ('error' in employee) return employee.error;
  if (!isValidEmail(input.email)) return fail(400, 'Email tidak valid.');
  const problem = passwordProblem(input.password);
  if (problem) return fail(400, problem);
  const result = await provisionHrisAccount(getAuthSql(), {
    idempotencyKey: `hris-account:${employeeId}:${Date.now()}`, employeeId, email: input.email,
    initialPassword: input.password, actorAccountId: actor.accountId,
  });
  if (!result.ok) {
    if (result.code === 'LINK_CONFLICT') return fail(409, 'Karyawan ini sudah punya akun.');
    if (result.code === 'EMAIL_TAKEN') return fail(409, 'Email sudah dipakai akun lain. Pakai "Tautkan akun yang ada" bila itu akun orang ini.');
    return fail(400, result.error);
  }
  await audit(actor, employeeId, 'account_create', { accountId: result.accountId, email: input.email.trim().toLowerCase() });
  return { ok: true, data: { accountId: result.accountId } };
}

export async function linkAccount(actor: Actor, employeeId: number, accountId: number): Promise<ServiceResult<object>> {
  const employee = await activeEmployee(employeeId);
  if ('error' in employee) return employee.error;
  const result = await linkExistingAccountToEmployee(getAuthSql(), { accountId, employeeId, actorAccountId: actor.accountId });
  if (!result.ok) {
    if (result.code === 'LINK_CONFLICT') return fail(409, 'Akun itu atau karyawan ini sudah bertaut ke yang lain.');
    if (result.code === 'SELF_FORBIDDEN') return fail(403, result.error);
    if (result.code === 'NOT_FOUND') return fail(404, 'Akun tidak ditemukan.');
    return fail(400, result.error);
  }
  await audit(actor, employeeId, 'account_link', { accountId });
  return { ok: true, data: {} };
}

export async function unlinkAccount(actor: Actor, employeeId: number, reasonInput: string): Promise<ServiceResult<object>> {
  const checked = await checkReason(reasonInput);
  if (!checked.ok) return fail(400, checked.error);
  const reason = checked.reason;
  const result = await unlinkEmployeeAccount(getAuthSql(), { employeeId, actorAccountId: actor.accountId, reason });
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') return fail(404, 'Karyawan ini tidak punya akun yang tertaut.');
    if (result.code === 'SELF_FORBIDDEN') return fail(403, result.error);
    return fail(400, result.error);
  }
  await audit(actor, employeeId, 'account_unlink', { accountId: result.accountId }, reason);
  return { ok: true, data: {} };
}

async function linkedAccountId(employeeId: number): Promise<number | ReturnType<typeof fail>> {
  const account = await findEmployeeAccount(getAuthSql(), employeeId);
  return account ? account.accountId : fail(404, 'Karyawan ini tidak punya akun yang tertaut.');
}

export async function resetAccountPassword(actor: Actor, employeeId: number, password: string): Promise<ServiceResult<object>> {
  const employee = await activeEmployee(employeeId);
  if ('error' in employee) return employee.error;
  const problem = passwordProblem(password);
  if (problem) return fail(400, problem);
  const accountId = await linkedAccountId(employeeId);
  if (typeof accountId !== 'number') return accountId;
  const result = await resetPasswordByTrustedCaller(getAuthSql(), { accountId, newPassword: password, actorAccountId: actor.accountId });
  if (!result.ok) return fail(result.code === 'SELF_FORBIDDEN' ? 403 : 400, result.error);
  await audit(actor, employeeId, 'account_reset_password', { accountId });
  return { ok: true, data: {} };
}

export async function revokeEmployeeSessions(actor: Actor, employeeId: number): Promise<ServiceResult<{ revoked: number }>> {
  const accountId = await linkedAccountId(employeeId);
  if (typeof accountId !== 'number') return accountId;
  const result = await revokeAccountSessions(getAuthSql(), { accountId, actorAccountId: actor.accountId });
  if (!result.ok) return fail(result.code === 'SELF_FORBIDDEN' ? 403 : 400, result.error);
  await audit(actor, employeeId, 'account_revoke_sessions', { accountId, revoked: result.revoked });
  return { ok: true, data: { revoked: result.revoked } };
}

export async function setKasirAccess(actor: Actor, employeeId: number, input: {
  active: boolean; roleName?: unknown; branchId?: unknown; assignedBranchIds?: unknown;
}): Promise<ServiceResult<{ created: boolean }>> {
  const employee = await getEmployeeBasic(employeeId);
  if (!employee) return fail(404, 'Karyawan tidak ditemukan.');
  if (input.active && !employee.activeToday) return fail(409, 'Karyawan nonaktif tidak bisa diberi akses kasir.');
  const accountId = await linkedAccountId(employeeId);
  if (typeof accountId !== 'number') return fail(409, 'Buat atau tautkan akun dulu sebelum memberi akses kasir.');

  let access: { roleName: string; branchId: number; assignedBranchIds: number[] };
  if (input.active) {
    const cleaned = cleanKasirAccess({ roleName: input.roleName, branchId: input.branchId, assignedBranchIds: input.assignedBranchIds });
    if (!cleaned.ok) return fail(400, cleaned.error);
    access = cleaned.value;
  } else {
    // Mencabut: role dan cabang yang ada dipertahankan, hanya status aktifnya yang dimatikan.
    const current = await fetchKasirAccess([accountId]);
    if (!current.ok) return fail(502, current.error);
    const view = current.data.access[String(accountId)];
    if (!view) return fail(409, 'Orang ini belum punya akses kasir.');
    access = { roleName: view.roleName, branchId: view.branchId, assignedBranchIds: view.assignedBranches.map((b) => b.id) };
  }
  const cleaned = cleanKasirAccess(access);
  if (!cleaned.ok) return fail(409, 'Role backoffice orang ini tidak bisa diatur dari HRIS; ubah lewat backoffice.');

  const result = await saveKasirAccess({
    ...cleaned.value, accountId, employeeName: employee.name, employeeCode: employee.code, active: input.active,
  });
  if (!result.ok) return fail(502, result.error);
  await audit(actor, employeeId, input.active ? 'kasir_access_set' : 'kasir_access_revoke', {
    accountId, ...cleaned.value, backofficeUserId: result.data.userId,
  });
  return { ok: true, data: { created: result.data.created } };
}

// ---------- Layar Akun & Tautan ----------

export async function listAccountsScreen(actor: Actor | null) {
  if (!can(actor, 'account.manage')) return null;
  const [accounts, employees] = await Promise.all([listAccounts(getAuthSql()), listEmployeeBasics()]);
  const byEmployee = new Map(employees.map((e) => [e.id, e]));
  const kasir = await fetchKasirAccess(accounts.map((a) => a.accountId));
  const linkedIds = new Set(accounts.map((a) => a.hrisEmployeeId).filter((id): id is number => id !== null));
  return {
    rows: accounts.map((account) => {
      const employee = account.hrisEmployeeId === null ? null : byEmployee.get(account.hrisEmployeeId) ?? null;
      return {
        ...toView(account),
        isSelf: account.accountId === actor?.accountId,
        employee: employee ? { id: employee.id, code: employee.code, name: employee.name, activeToday: employee.activeToday } : null,
        kasir: kasir.ok ? kasir.data.access[String(account.accountId)] ?? null : null,
        hasBackofficeLink: account.backofficeUserId !== null,
      };
    }),
    kasirError: kasir.ok ? null : kasir.error,
    // Karyawan aktif yang belum punya akun: tujuan "Tautkan ke karyawan".
    unlinkedEmployees: employees.filter((e) => e.activeToday && !linkedIds.has(e.id))
      .map((e) => ({ id: e.id, code: e.code, name: e.name })),
  };
}

export type AccountsScreenData = NonNullable<Awaited<ReturnType<typeof listAccountsScreen>>>;

// ---------- Riwayat masuk ----------

export type LoginHistoryFilter = { accountId?: number; outcome?: 'SUCCESS' | 'REJECTED'; from?: string; to?: string; page: number };

const PAGE_SIZE = 50;

/** KAR-L40 Riwayat Masuk Semua Orang. */
export async function getLoginHistory(actor: Actor | null, filter: LoginHistoryFilter) {
  if (!can(actor, 'login_history.view_all')) return null;
  const range = loginRange(filter.from, filter.to, todayWib());
  const page = Math.max(1, Math.trunc(filter.page) || 1);
  const [events, accounts, employees] = await Promise.all([
    listLoginEvents(getAuthSql(), {
      from: range.fromInstant, to: range.toInstant, accountId: filter.accountId, outcome: filter.outcome,
      limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE,
    }),
    listAccounts(getAuthSql()),
    listEmployeeBasics(),
  ]);
  const names = new Map(employees.map((e) => [e.id, e.name]));
  const accountName = new Map(accounts.map((a) => [a.accountId, a.hrisEmployeeId ? names.get(a.hrisEmployeeId) ?? null : null]));
  return {
    range: { from: range.from, to: range.to },
    page, pageSize: PAGE_SIZE, total: events.total,
    rows: events.rows.map((row) => ({
      id: row.id, at: row.createdAt.toISOString(), accountId: row.accountId,
      who: row.accountId ? accountName.get(row.accountId) ?? row.email ?? row.username ?? `Akun #${row.accountId}` : 'Tidak dikenal',
      identifier: row.email ?? row.username, appCode: row.appCode, authMethod: row.authMethod, outcome: row.outcome,
      deviceLabel: row.deviceLabel,
    })),
    accountOptions: accounts.map((a) => ({
      accountId: a.accountId,
      label: (a.hrisEmployeeId ? names.get(a.hrisEmployeeId) : null) ?? accountLabel(a),
    })).sort((a, b) => a.label.localeCompare(b.label, 'id')),
  };
}

export type LoginHistoryData = NonNullable<Awaited<ReturnType<typeof getLoginHistory>>>;

// ---------- Perangkat dan riwayat masuk saya (KAR-L14) ----------

export async function getOwnDevices(actor: Actor | null, currentSessionId: number) {
  if (!actor || !can(actor, 'login_history.view_own', { personId: actor.personId })) return null;
  const range = loginRange(undefined, undefined, todayWib());
  const from = new Date(range.toInstant.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [sessions, events] = await Promise.all([
    listActiveSessions(getAuthSql(), actor.accountId),
    listLoginEvents(getAuthSql(), { from, to: range.toInstant, accountId: actor.accountId, limit: 50, offset: 0 }),
  ]);
  return {
    canRevokeOthers: can(actor, 'own_account.manage', { personId: actor.personId }),
    sessions: sessions.map((s) => ({
      sessionId: s.sessionId, deviceLabel: s.deviceLabel, authMethod: s.authMethod, apps: s.apps,
      createdAt: s.createdAt.toISOString(), lastActiveAt: s.lastActiveAt?.toISOString() ?? null,
      current: s.sessionId === currentSessionId,
    })),
    events: events.rows.map((e) => ({
      id: e.id, at: e.createdAt.toISOString(), appCode: e.appCode, authMethod: e.authMethod, outcome: e.outcome,
      deviceLabel: e.deviceLabel,
    })),
  };
}

export type OwnDevices = NonNullable<Awaited<ReturnType<typeof getOwnDevices>>>;

export async function revokeOtherDevices(actor: Actor, currentSessionId: number): Promise<ServiceResult<{ revoked: number }>> {
  const result = await revokeAccountSessions(getAuthSql(), {
    accountId: actor.accountId, actorAccountId: actor.accountId, exceptSessionId: currentSessionId,
  });
  if (!result.ok) return fail(400, result.error);
  return { ok: true, data: { revoked: result.revoked } };
}

/**
 * Akun HRIS aktif per karyawan (penerima pemberitahuan, spec L2f-1 §6). Karyawan tanpa akun aktif tidak ikut.
 */
export async function activeHrisAccounts(employeeIds: number[]): Promise<Map<number, number>> {
  const wanted = new Set(employeeIds);
  if (!wanted.size) return new Map();
  const accounts = await listAccounts(getAuthSql());
  return new Map(accounts
    .filter((a) => a.isActive && a.hrisEmployeeId != null && wanted.has(a.hrisEmployeeId))
    .map((a) => [a.hrisEmployeeId as number, a.accountId]));
}
