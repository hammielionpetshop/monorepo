import { eq, sql } from 'drizzle-orm';
import { employees, placements } from '@petshop/hris-db/schema/employees';
import { db } from '@/lib/db';
import {
  can, getOrgLookup, recordAudit, type Actor, type ServiceResult, type Target,
} from '@/modules/access';
import { isIsoDate, todayWib, type IsoDate } from '../rules/dates';
import {
  OWN_CONTACT_FIELDS, PERSON_FIELDS, cleanPersonFields, maskAccountNumber, type Gender, type PersonValues,
} from '../rules/fields';
import { WORK_STATUSES, type WorkStatus } from '../rules/history';
import {
  loadBundle, loadSummaries, lockEmployee, summarize, targetOf, type EmployeeBundle, type EmployeeSummary,
} from './data';

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string; constraint?: string };
  return pg?.code === '23505' && (pg.constraint_name ?? pg.constraint) === constraint;
}

export type EmployeeFilter = {
  q?: string;
  branchId?: number;
  positionId?: number;
  workStatus?: WorkStatus;
  activity?: 'active' | 'inactive' | 'all';
  page?: number;
};

const PAGE_SIZE = 25;

function matches(summary: EmployeeSummary, filter: EmployeeFilter): boolean {
  const q = filter.q?.trim().toLowerCase();
  if (q) {
    const digits = q.replace(/\D/g, '');
    const hit = summary.name.toLowerCase().includes(q) || summary.code.toLowerCase().includes(q)
      || (digits.length >= 3 && !!summary.phone?.includes(digits));
    if (!hit) return false;
  }
  if (filter.branchId && summary.branchId !== filter.branchId) return false;
  if (filter.positionId && summary.positionId !== filter.positionId) return false;
  if (filter.workStatus && summary.workStatus !== filter.workStatus) return false;
  const activity = filter.activity ?? 'active';
  if (activity === 'active' && !summary.activeToday) return false;
  if (activity === 'inactive' && summary.activeToday) return false;
  return true;
}

/**
 * Daftar Karyawan (KAR-L20). Versi lengkap untuk `employee.list`; versi terbatas (nama, cabang, jabatan,
 * izin) untuk `employee.directory` (KAR-84). Kolom dipilih di server, bukan di layar (H5).
 */
export async function listEmployees(actor: Actor | null, filter: EmployeeFilter) {
  const { org, summaries } = await loadSummaries();
  const full = summaries.filter((s) => can(actor, 'employee.list', targetOf(s)));
  const limited = full.length ? [] : summaries.filter((s) => s.activeToday && can(actor, 'employee.directory', targetOf(s)));
  const mode: 'full' | 'directory' | 'none' = full.length ? 'full' : limited.length ? 'directory' : 'none';
  const visible = (mode === 'full' ? full : limited).filter((s) => matches(s, mode === 'directory' ? { ...filter, activity: 'active' } : filter));
  const page = Math.max(1, filter.page ?? 1);
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return {
    mode,
    total: visible.length,
    page,
    pageCount: Math.max(1, Math.ceil(visible.length / PAGE_SIZE)),
    rows: pageRows.map((s) => mode === 'full'
      ? { ...s, canOpen: can(actor, 'profile.view', targetOf(s)) || can(actor, 'field_permit.update', targetOf(s)) }
      : {
        id: s.id, code: s.code, name: s.name, branchName: s.branchName, positionName: s.positionName,
        permits: s.permits, canOpen: can(actor, 'field_permit.update', targetOf(s)),
      }),
    org,
  };
}

export type EmployeeListing = Awaited<ReturnType<typeof listEmployees>>;

/** Halaman orang (KAR-L21). Pengunjung tanpa `profile.view` hanya melihat kepala dan izin bila berhak. */
export async function getEmployeeDetail(actor: Actor | null, id: number) {
  const bundle = await loadBundle(db, id);
  if (!bundle) return null;
  const org = await getOrgLookup();
  const today = todayWib();
  const summary = summarize(bundle, org, today);
  const target = targetOf(summary);
  const canView = can(actor, 'profile.view', target);
  const canPermits = can(actor, 'field_permit.update', target);
  if (!canView && !canPermits) return { allowed: false as const };
  const isSelf = actor?.personId === id;
  const rights = {
    update: can(actor, 'employee.update', target),
    recordPlacement: can(actor, 'placement.record', target),
    activation: can(actor, 'employee.activation', target),
    setUnnotified: can(actor, 'resignation.set_unnotified', target),
    permits: canPermits,
    // KAR-74: penempatan/status pemegang jabatan berhak tinggi hanya diubah Pemilik/GM.
    touchHighRights: !!actor?.fullAccess,
  };
  const branchName = (branchId: number) => org.branches.find((b) => b.id === branchId)?.name ?? '—';
  const positionName = (positionId: number) => org.positions.find((p) => p.id === positionId)?.name ?? '—';
  const showFull = canView;
  const person = showFull ? {
    ...pickPerson(bundle.employee),
    bankAccountNumber: rights.update ? bundle.employee.bankAccountNumber : maskAccountNumber(bundle.employee.bankAccountNumber),
  } : null;
  return {
    allowed: true as const,
    today,
    isSelf,
    summary,
    person,
    rights,
    org,
    placements: showFull ? bundle.placements.map((p) => ({
      id: p.id, kind: p.kind, effectiveFrom: p.effectiveFrom, branchId: p.branchId, branchName: branchName(p.branchId),
      positionId: p.positionId, positionName: positionName(p.positionId), workStatus: p.workStatus, reason: p.reason,
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null, cancelReason: p.cancelReason,
      linkedToPromotion: bundle.reviews.some((r) => r.placementId === p.id),
    })) : [],
    events: showFull ? bundle.events.map((e) => ({
      id: e.id, kind: e.kind, effectiveOn: e.effectiveOn, reasonKind: e.reasonKind,
      resignationNotice: e.resignationNotice, note: e.note,
    })) : [],
    permits: bundle.permits.map((p) => ({
      id: p.id, kind: p.kind, grantedAt: p.grantedAt.toISOString(), revokedAt: p.revokedAt?.toISOString() ?? null,
      revokeReason: p.revokeReason,
    })),
  };
}

export type EmployeeDetail = Extract<NonNullable<Awaited<ReturnType<typeof getEmployeeDetail>>>, { allowed: true }>;

function pickPerson(row: typeof employees.$inferSelect): PersonValues & { code: string; joinedOn: IsoDate; source: string } {
  return {
    code: row.code, joinedOn: row.joinedOn, source: row.source,
    name: row.name, phone: row.phone, email: row.email, birthDate: row.birthDate, gender: row.gender as Gender | null,
    address: row.address, emergencyContactName: row.emergencyContactName, emergencyContactPhone: row.emergencyContactPhone,
    birthPlace: row.birthPlace, religion: row.religion, maritalStatus: row.maritalStatus, dependents: row.dependents,
    education: row.education, bankName: row.bankName, bankAccountNumber: row.bankAccountNumber,
    bankAccountHolder: row.bankAccountHolder,
  };
}

/** Profil saya (KAR-L10): data sendiri, rekening disamarkan. */
export async function getOwnProfile(actor: Actor | null) {
  if (!actor || !can(actor, 'profile.view', { personId: actor.personId })) return null;
  const bundle = await loadBundle(db, actor.personId);
  if (!bundle) return null;
  const org = await getOrgLookup();
  const summary = summarize(bundle, org);
  const branchName = (id: number) => org.branches.find((b) => b.id === id)?.name ?? '—';
  const positionName = (id: number) => org.positions.find((p) => p.id === id)?.name ?? '—';
  return {
    summary,
    person: { ...pickPerson(bundle.employee), bankAccountNumber: maskAccountNumber(bundle.employee.bankAccountNumber) },
    canEditContact: can(actor, 'contact.update_own', { personId: actor.personId }),
    placements: bundle.placements.filter((p) => !p.cancelledAt).map((p) => ({
      id: p.id, kind: p.kind, effectiveFrom: p.effectiveFrom, branchName: branchName(p.branchId),
      positionName: positionName(p.positionId), workStatus: p.workStatus,
    })),
  };
}

export type OwnProfile = NonNullable<Awaited<ReturnType<typeof getOwnProfile>>>;

export type CreateEmployeeInput = Record<string, unknown> & {
  branchId: number;
  positionId: number;
  workStatus: WorkStatus;
  joinedOn: string;
};

/** Tambah Karyawan (KAR-60): hanya Pemilik/GM. Kode dari server (KAR-02); tanpa akun (L2d). */
export async function createEmployee(actor: Actor | null, input: CreateEmployeeInput): Promise<ServiceResult<{ id: number; code: string }>> {
  if (!actor || !can(actor, 'employee.create')) return fail(403, 'Hanya Pemilik dan GM yang bisa menambah karyawan.');
  const fields = cleanPersonFields(input, ['name', 'phone', 'email', 'birthDate', 'gender']);
  if (!fields.ok) return fail(400, fields.error);
  if (!fields.values.name) return fail(400, 'Nama wajib diisi (2–100 karakter).');
  if (!isIsoDate(input.joinedOn)) return fail(400, 'Tanggal bergabung wajib diisi.');
  if (!WORK_STATUSES.includes(input.workStatus)) return fail(400, 'Status kerja tidak valid.');
  const org = await getOrgLookup();
  const branch = org.branches.find((b) => b.id === input.branchId);
  const position = org.positions.find((p) => p.id === input.positionId);
  if (!branch?.active) return fail(400, 'Pilih cabang yang aktif.');
  if (!position?.active) return fail(400, 'Pilih jabatan yang aktif.');
  if (position.highRights && !actor.fullAccess) return fail(403, 'Jabatan berhak tinggi hanya bisa diisi Pemilik dan GM.');

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(employees).values({
        ...fields.values, name: fields.values.name as string,
        code: sql`hris.next_employee_code()`, joinedOn: input.joinedOn, source: 'HRIS', createdByAccountId: actor.accountId,
      }).returning();
      const [placement] = await tx.insert(placements).values({
        employeeId: created.id, kind: 'INITIAL', branchId: branch.id, positionId: position.id,
        workStatus: input.workStatus, effectiveFrom: input.joinedOn, reason: 'Karyawan baru.',
        createdByAccountId: actor.accountId,
      }).returning();
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'employee', entityId: created.id, action: 'create',
        after: { employee: created, placement },
      });
      return { ok: true as const, data: { id: created.id, code: created.code } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'employees_phone_unique')) return fail(409, 'Nomor HP sudah dipakai orang lain.');
    throw error;
  }
}

async function updateFields(actor: Actor, id: number, values: Partial<PersonValues>, action: string, reason: string | null)
  : Promise<ServiceResult<{ id: number }>> {
  if (!Object.keys(values).length) return fail(400, 'Tidak ada isian yang diubah.');
  try {
    return await db.transaction(async (tx) => {
      if (!(await lockEmployee(tx, id))) return fail(404, 'Karyawan tidak ditemukan.');
      const [before] = await tx.select().from(employees).where(eq(employees.id, id));
      const changed = Object.fromEntries(Object.entries(values)
        .filter(([key, value]) => before[key as keyof typeof before] !== value));
      if (!Object.keys(changed).length) return fail(400, 'Tidak ada isian yang berubah.');
      const [after] = await tx.update(employees).set({ ...changed, updatedAt: new Date() }).where(eq(employees.id, id)).returning();
      const beforeValues = Object.fromEntries(Object.keys(changed).map((key) => [key, before[key as keyof typeof before]]));
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'employee', entityId: id, action,
        before: beforeValues, after: Object.fromEntries(Object.keys(changed).map((key) => [key, after[key as keyof typeof after]])),
        reason,
      });
      return { ok: true as const, data: { id } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'employees_phone_unique')) return fail(409, 'Nomor HP sudah dipakai orang lain.');
    throw error;
  }
}

/** Ubah data orang oleh HR (KAR-L21): langsung berlaku, tercatat sebelum dan sesudah. */
export async function updatePerson(actor: Actor | null, id: number, input: Record<string, unknown>, reason: string | null)
  : Promise<ServiceResult<{ id: number }>> {
  const detail = await loadTarget(id);
  if (!detail) return fail(404, 'Karyawan tidak ditemukan.');
  if (!actor || !can(actor, 'employee.update', detail)) {
    return fail(403, actor?.personId === id
      ? 'Data diri sendiri diubah lewat Profil saya.'
      : 'Anda tidak berhak mengubah data orang ini.');
  }
  const fields = cleanPersonFields(input, PERSON_FIELDS);
  if (!fields.ok) return fail(400, fields.error);
  return updateFields(actor, id, fields.values, 'update', reason?.trim() || null);
}

/** Ubah kontak sendiri (KAR-L11): langsung berlaku. */
export async function updateOwnContact(actor: Actor | null, input: Record<string, unknown>): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'contact.update_own', { personId: actor.personId })) {
    return fail(403, 'Anda tidak berhak mengubah kontak.');
  }
  const fields = cleanPersonFields(input, OWN_CONTACT_FIELDS);
  if (!fields.ok) return fail(400, fields.error);
  return updateFields(actor, actor.personId, fields.values, 'update_own_contact', null);
}

/** Target `can()` satu orang dari penempatannya hari ini. */
export async function loadTarget(id: number) {
  const bundle = await loadBundle(db, id);
  if (!bundle) return null;
  return targetOf(summarize(bundle, await getOrgLookup()));
}

/** Data ringkas orang untuk modul lain (mis. Akun & Tautan): tanpa data pribadi selain email kerja. */
export type EmployeeBasic = {
  id: number; code: string; name: string; email: string | null; activeToday: boolean;
  branchName: string; positionName: string; target: Target;
};

function toBasic(bundle: EmployeeBundle, summary: EmployeeSummary): EmployeeBasic {
  return {
    id: summary.id, code: summary.code, name: summary.name, email: bundle.employee.email,
    activeToday: summary.activeToday, branchName: summary.branchName, positionName: summary.positionName,
    target: targetOf(summary),
  };
}

export async function getEmployeeBasic(id: number): Promise<EmployeeBasic | null> {
  const bundle = await loadBundle(db, id);
  if (!bundle) return null;
  return toBasic(bundle, summarize(bundle, await getOrgLookup()));
}

export async function listEmployeeBasics(): Promise<EmployeeBasic[]> {
  const { bundles, summaries } = await loadSummaries();
  return summaries.map((summary, index) => toBasic(bundles[index], summary));
}
