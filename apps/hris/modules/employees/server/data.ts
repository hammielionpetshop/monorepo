import { asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  employees, employmentEvents, fieldPermits, placements, trainingReviews,
} from '@petshop/hris-db/schema/employees';
import { db } from '@/lib/db';
import { getOrgLookup, type OrgLookup, type Target, type Tx } from '@/modules/access';
import { settingVersions } from '@/modules/settings';
import { todayWib, type IsoDate, type TrainingMonthsVersion } from '../rules/dates';
import {
  activeOn, lastEvent, placementOn, type EmploymentEventRecord, type PlacementRecord, type WorkStatus,
} from '../rules/history';
import { promotionDueOn, type TrainingReviewRecord } from '../rules/promotion';

export type Executor = typeof db | Tx;

export type EmployeeRow = typeof employees.$inferSelect;
export type PlacementRow = typeof placements.$inferSelect;
export type EventRow = typeof employmentEvents.$inferSelect;
export type PermitRow = typeof fieldPermits.$inferSelect;
export type ReviewRow = typeof trainingReviews.$inferSelect;

export type EmployeeBundle = {
  employee: EmployeeRow;
  placements: PlacementRow[];
  events: EventRow[];
  permits: PermitRow[];
  reviews: ReviewRow[];
  /** Riwayat pengaturan masa training (spec L2e §3.3); sama untuk semua orang. */
  trainingMonths: TrainingMonthsVersion[];
};

const asPlacement = (row: PlacementRow): PlacementRecord => ({
  id: row.id, kind: row.kind, branchId: row.branchId, positionId: row.positionId,
  workStatus: row.workStatus, effectiveFrom: row.effectiveFrom, cancelledAt: row.cancelledAt,
});
const asEvent = (row: EventRow): EmploymentEventRecord => ({ id: row.id, kind: row.kind, effectiveOn: row.effectiveOn });
const asReview = (row: ReviewRow): TrainingReviewRecord => ({
  id: row.id, decision: row.decision, reviewAgainOn: row.reviewAgainOn,
});

export const toPlacementRecords = (rows: PlacementRow[]) => rows.map(asPlacement);
export const toEventRecords = (rows: EventRow[]) => rows.map(asEvent);

function groupBy<T extends { employeeId: number }>(rows: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) map.set(row.employeeId, [...(map.get(row.employeeId) ?? []), row]);
  return map;
}

/** Semua karyawan beserta riwayatnya (jumlah orang kecil; disaring di aplikasi). */
export async function loadBundles(executor: Executor = db, ids?: number[]): Promise<EmployeeBundle[]> {
  const only = <T>(column: Parameters<typeof inArray>[0]) => (ids ? inArray(column, ids) : undefined) as T;
  const [employeeRows, placementRows, eventRows, permitRows, reviewRows, monthRows] = await Promise.all([
    executor.select().from(employees).where(only(employees.id)).orderBy(asc(employees.name)),
    executor.select().from(placements).where(only(placements.employeeId)).orderBy(asc(placements.effectiveFrom), asc(placements.id)),
    executor.select().from(employmentEvents).where(only(employmentEvents.employeeId)).orderBy(asc(employmentEvents.effectiveOn), asc(employmentEvents.id)),
    executor.select().from(fieldPermits).where(only(fieldPermits.employeeId)).orderBy(asc(fieldPermits.grantedAt)),
    executor.select().from(trainingReviews).where(only(trainingReviews.employeeId)).orderBy(asc(trainingReviews.id)),
    settingVersions('employees.training_review_months', executor),
  ]);
  const trainingMonths = monthRows.map((v) => ({ from: v.from, months: Number(v.value) }));
  const byPlacement = groupBy(placementRows);
  const byEvent = groupBy(eventRows);
  const byPermit = groupBy(permitRows);
  const byReview = groupBy(reviewRows);
  return employeeRows.map((employee) => ({
    employee,
    placements: byPlacement.get(employee.id) ?? [],
    events: byEvent.get(employee.id) ?? [],
    permits: byPermit.get(employee.id) ?? [],
    reviews: byReview.get(employee.id) ?? [],
    trainingMonths,
  }));
}

export async function loadBundle(executor: Executor, id: number): Promise<EmployeeBundle | null> {
  const [bundle] = await loadBundles(executor, [id]);
  return bundle ?? null;
}

/** Mengunci baris karyawan sampai transaksi selesai, supaya dua catatan tidak saling mendahului. */
export async function lockEmployee(tx: Tx, id: number): Promise<boolean> {
  const rows = await tx.select({ id: employees.id }).from(employees).where(eq(employees.id, id)).for('update');
  return rows.length > 0;
}

export type EmployeeSummary = {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  joinedOn: IsoDate;
  branchId: number;
  branchName: string;
  positionId: number;
  positionName: string;
  positionHighRights: boolean;
  departmentId: number;
  departmentName: string;
  workStatus: WorkStatus;
  activeToday: boolean;
  /** Kejadian terakhir yang tercatat, termasuk bertanggal depan. */
  pendingStatus: { kind: 'DEACTIVATE' | 'REACTIVATE'; effectiveOn: IsoDate } | null;
  hasBankAccount: boolean;
  promotionDueOn: IsoDate | null;
  permits: { DRIVE: boolean; ASSIST: boolean };
};

/** Ringkasan per orang pada hari ini. Sebelum mulai bekerja, penempatan awal yang dipakai. */
export function summarize(bundle: EmployeeBundle, org: OrgLookup, today: IsoDate = todayWib()): EmployeeSummary {
  const records = toPlacementRecords(bundle.placements);
  const current = placementOn(records, today) ?? records.find((r) => r.kind === 'INITIAL') ?? records[0];
  const events = toEventRecords(bundle.events);
  const active = activeOn(events, today);
  const last = lastEvent(events);
  const branch = org.branches.find((b) => b.id === current?.branchId);
  const position = org.positions.find((p) => p.id === current?.positionId);
  const activePermits = bundle.permits.filter((p) => !p.revokedAt);
  const startedWork = placementOn(records, today) != null;
  return {
    id: bundle.employee.id,
    code: bundle.employee.code,
    name: bundle.employee.name,
    phone: bundle.employee.phone,
    joinedOn: bundle.employee.joinedOn,
    branchId: current?.branchId ?? 0,
    branchName: branch?.name ?? '—',
    positionId: current?.positionId ?? 0,
    positionName: position?.name ?? '—',
    positionHighRights: position?.highRights ?? false,
    departmentId: position?.departmentId ?? 0,
    departmentName: position?.departmentName ?? '—',
    workStatus: current?.workStatus ?? 'TRAINING',
    activeToday: active,
    pendingStatus: last && last.effectiveOn > today ? { kind: last.kind, effectiveOn: last.effectiveOn } : null,
    hasBankAccount: !!bundle.employee.bankAccountNumber,
    promotionDueOn: promotionDueOn({
      joinedOn: bundle.employee.joinedOn,
      workStatusToday: startedWork ? current?.workStatus ?? null : null,
      activeToday: active,
      reviews: bundle.reviews.map(asReview),
      today,
      trainingMonths: bundle.trainingMonths,
    }),
    permits: {
      DRIVE: activePermits.some((p) => p.kind === 'DRIVE'),
      ASSIST: activePermits.some((p) => p.kind === 'ASSIST'),
    },
  };
}

/** Target `can()` untuk data orang ini: pemiliknya dan penempatannya hari ini. */
export function targetOf(summary: Pick<EmployeeSummary, 'id' | 'branchId' | 'departmentId'>): Target {
  return { personId: summary.id, branchId: summary.branchId, departmentId: summary.departmentId };
}

export async function loadSummaries(executor: Executor = db) {
  const [bundles, org] = await Promise.all([loadBundles(executor), getOrgLookup()]);
  const today = todayWib();
  return { org, today, bundles, summaries: bundles.map((bundle) => summarize(bundle, org, today)) };
}

export async function pendingStatusEmployees(executor: Executor, today: IsoDate): Promise<number[]> {
  const rows = await executor.selectDistinct({ id: employmentEvents.employeeId }).from(employmentEvents)
    .where(sql`${isNull(employmentEvents.accountAppliedAt)} and ${employmentEvents.effectiveOn} <= ${today}`);
  return rows.map((row) => row.id);
}
