import { and, asc, eq } from 'drizzle-orm';
import { reportGuides } from '@petshop/hris-db/schema/guides';
import { db } from '@/lib/db';
import { auditTrail, hasAction, recordAudit, type Actor, type ServiceResult } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules } from '@/modules/employees';
import { REQUEST_TYPES, REQUEST_TYPE_KEYS, isRequestTypeKey } from '@/modules/requests';
import { cleanReportGuide, moveInOrder, reportGuideProblem, type ReportGuideInput } from '../rules/report-guides';

// Pedoman Lapor (spec F3-5 §2): baca untuk semua, ubah hanya Pemilik/GM (`report_guide.manage`, ownerOnly).

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
const ENTITY = 'report_guide';
const FORBIDDEN = 'Hanya Pemilik atau GM yang mengubah Pedoman Lapor.';

type Row = typeof reportGuides.$inferSelect;

export type ReportGuideRow = { id: number; caseLabel: string; reportTo: string; requestType: string | null };
export type ReportGuideHistory = { what: string; by: string; at: string };
export type ReportGuideEditRow = ReportGuideRow & { active: boolean; history: ReportGuideHistory[] };
export type ReportGuideEditScreen = { rows: ReportGuideEditRow[]; typeOptions: { key: string; label: string }[] };

function caseLabelOf(row: Pick<Row, 'requestType' | 'caseLabel'>): string {
  if (row.requestType) return isRequestTypeKey(row.requestType) ? REQUEST_TYPES[row.requestType].label : row.requestType;
  return row.caseLabel ?? '';
}

function toRow(row: Row): ReportGuideRow {
  return { id: row.id, caseLabel: caseLabelOf(row), reportTo: row.reportTo, requestType: row.requestType };
}

async function orderedRows(tx: Pick<typeof db, 'select'> = db): Promise<Row[]> {
  return tx.select().from(reportGuides).orderBy(asc(reportGuides.sortOrder), asc(reportGuides.id));
}

export function canManageReportGuides(actor: Actor | null): boolean {
  return hasAction(actor, 'report_guide.manage');
}

/** KAR-L34: baris aktif berurutan. */
export async function listReportGuides(): Promise<ReportGuideRow[]> {
  return (await orderedRows()).filter((row) => row.active).map(toRow);
}

/** Baris pedoman di kepala isian pengajuan (BER-L06); null = jenis ini tanpa baris aktif. */
export async function reportGuideLine(typeKey: string): Promise<string | null> {
  const [row] = await db.select({ reportTo: reportGuides.reportTo }).from(reportGuides)
    .where(and(eq(reportGuides.requestType, typeKey), eq(reportGuides.active, true)));
  return row?.reportTo ?? null;
}

/** Baris aktif per jenis pengajuan (layar Jenis Pengajuan). */
export async function reportGuideLinesByType(): Promise<Map<string, string>> {
  const rows = await db.select({ requestType: reportGuides.requestType, reportTo: reportGuides.reportTo }).from(reportGuides)
    .where(eq(reportGuides.active, true));
  return new Map(rows.flatMap((row) => (row.requestType ? [[row.requestType, row.reportTo] as const] : [])));
}

const ACTION_LABELS: Record<string, string> = {
  'report_guide.create': 'Ditambahkan',
  'report_guide.update': 'Diubah',
  'report_guide.deactivate': 'Dinonaktifkan',
  'report_guide.activate': 'Diaktifkan',
  'report_guide.move': 'Urutan digeser',
};

function historyText(action: string, before: unknown, after: unknown): string {
  const label = ACTION_LABELS[action] ?? action;
  if (action !== 'report_guide.update') return label;
  const old = (before as { reportTo?: string } | null)?.reportTo;
  const now = (after as { reportTo?: string } | null)?.reportTo;
  return old && now && old !== now ? `${label}: "${old}" → "${now}"` : label;
}

async function accountNameMap(): Promise<Map<number, string>> {
  const people = await listPeopleForModules();
  const accounts = await activeHrisAccounts(people.map((p) => p.id));
  const names = new Map<number, string>();
  for (const person of people) {
    const accountId = accounts.get(person.id);
    if (accountId) names.set(accountId, person.name);
  }
  return names;
}

/** KAR-L35 Ubah Pedoman Lapor: semua baris (termasuk nonaktif) dengan riwayatnya. */
export async function reportGuidesEditScreen(actor: Actor | null): Promise<ReportGuideEditScreen | null> {
  if (!canManageReportGuides(actor)) return null;
  const rows = await orderedRows();
  const [trail, names] = await Promise.all([auditTrail(ENTITY, rows.map((row) => row.id)), accountNameMap()]);
  const history = new Map<number, ReportGuideHistory[]>();
  for (const event of trail) {
    if (event.entityId == null) continue;
    const list = history.get(event.entityId) ?? [];
    list.push({
      what: historyText(event.action, event.before, event.after),
      by: event.actorAccountId ? names.get(event.actorAccountId) ?? 'Akun lain' : 'Sistem',
      at: event.at,
    });
    history.set(event.entityId, list);
  }
  return {
    rows: rows.map((row) => ({ ...toRow(row), active: row.active, history: history.get(row.id) ?? [] })),
    typeOptions: REQUEST_TYPE_KEYS.map((key) => ({ key, label: REQUEST_TYPES[key].label })),
  };
}

function uniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
  return (cause as { code?: string })?.code === '23505';
}
const DUPLICATE = 'Jenis pengajuan itu sudah punya pedoman aktif. Ubah baris yang ada, atau nonaktifkan dulu.';

/** Tambah (id kosong) atau ubah satu baris. */
export async function saveReportGuide(actor: Actor | null, id: number | null, input: ReportGuideInput, now: Date = new Date())
  : Promise<ServiceResult<{ id: number }>> {
  if (!actor || !canManageReportGuides(actor)) return fail(403, FORBIDDEN);
  const clean = cleanReportGuide(input);
  const problem = reportGuideProblem(clean, isRequestTypeKey);
  if (problem) return fail(400, problem);
  try {
    return await db.transaction(async (tx) => {
      if (id) {
        const [old] = await tx.select().from(reportGuides).where(eq(reportGuides.id, id));
        if (!old) return fail(404, 'Baris pedoman tidak ditemukan.');
        await tx.update(reportGuides).set({ ...clean, updatedByAccountId: actor.accountId, updatedAt: now }).where(eq(reportGuides.id, id));
        await recordAudit(tx, {
          actorAccountId: actor.accountId, entity: ENTITY, entityId: id, action: 'report_guide.update',
          before: { requestType: old.requestType, caseLabel: old.caseLabel, reportTo: old.reportTo }, after: clean,
        });
        return { ok: true as const, data: { id } };
      }
      const rows = await orderedRows(tx);
      const sortOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
      const [row] = await tx.insert(reportGuides)
        .values({ ...clean, sortOrder, active: true, updatedByAccountId: actor.accountId, updatedAt: now })
        .returning({ id: reportGuides.id });
      await recordAudit(tx, { actorAccountId: actor.accountId, entity: ENTITY, entityId: row.id, action: 'report_guide.create', before: null, after: clean });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    if (uniqueViolation(error)) return fail(409, DUPLICATE);
    throw error;
  }
}

/** Nonaktifkan / aktifkan kembali (tidak ada hapus, spec F3-5 §2.2). */
export async function setReportGuideActive(actor: Actor | null, id: number, active: boolean, now: Date = new Date())
  : Promise<ServiceResult<object>> {
  if (!actor || !canManageReportGuides(actor)) return fail(403, FORBIDDEN);
  try {
    return await db.transaction(async (tx) => {
      const [old] = await tx.select().from(reportGuides).where(eq(reportGuides.id, id));
      if (!old) return fail(404, 'Baris pedoman tidak ditemukan.');
      if (old.active === active) return { ok: true as const, data: {} };
      await tx.update(reportGuides).set({ active, updatedByAccountId: actor.accountId, updatedAt: now }).where(eq(reportGuides.id, id));
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: ENTITY, entityId: id, action: active ? 'report_guide.activate' : 'report_guide.deactivate',
        before: { active: old.active }, after: { active },
      });
      return { ok: true as const, data: {} };
    });
  } catch (error) {
    if (uniqueViolation(error)) return fail(409, DUPLICATE);
    throw error;
  }
}

/** Geser satu baris naik/turun; seluruh urutan dinomori ulang 1..n. */
export async function moveReportGuide(actor: Actor | null, id: number, direction: 'up' | 'down', now: Date = new Date())
  : Promise<ServiceResult<object>> {
  if (!actor || !canManageReportGuides(actor)) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const rows = await orderedRows(tx);
    if (!rows.some((row) => row.id === id)) return fail(404, 'Baris pedoman tidak ditemukan.');
    const next = moveInOrder(rows, id, direction);
    if (!next) return { ok: true as const, data: {} };
    for (const [index, row] of next.entries()) {
      if (row.sortOrder !== index + 1) {
        await tx.update(reportGuides).set({ sortOrder: index + 1, ...(row.id === id ? { updatedByAccountId: actor.accountId, updatedAt: now } : {}) })
          .where(eq(reportGuides.id, row.id));
      }
    }
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: ENTITY, entityId: id, action: 'report_guide.move', before: null, after: { direction } });
    return { ok: true as const, data: {} };
  });
}
