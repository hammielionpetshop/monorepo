import { asc, eq, inArray } from 'drizzle-orm';
import {
  salaryChangeLines, salaryChangeProposals, salaryChanges, salaryComponentTypes, salaryStandardLines, salaryStandards,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, getOrgLookup, type Actor, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules, todayWib, type PersonForModules } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import { packageOn, periodStartOf, type IsoDate, type SalaryLine } from '../rules/salary';

export type Executor = typeof db | Tx;

export type ComponentType = { id: number; name: string; sortOrder: number; active: boolean };

export async function loadTypes(executor: Executor = db): Promise<ComponentType[]> {
  return executor.select({
    id: salaryComponentTypes.id, name: salaryComponentTypes.name, sortOrder: salaryComponentTypes.sortOrder, active: salaryComponentTypes.active,
  }).from(salaryComponentTypes).orderBy(asc(salaryComponentTypes.sortOrder), asc(salaryComponentTypes.id));
}

export type PackageRow = {
  id: number; employeeId: number; effectiveFrom: IsoDate; cancelled: boolean; origin: 'DIRECT' | 'PROPOSAL' | 'STANDARD_PROMOTION' | 'CORRECTION';
  reason: string; createdByAccountId: number; proposedByAccountId: number | null; createdAt: Date; requestId: number | null;
  cancelledAt: Date | null; cancelledByAccountId: number | null; cancelReason: string | null; lines: SalaryLine[];
};

/** Semua paket gaji orang-orang ini (termasuk yang dibatalkan), urut tanggal berlaku. */
export async function loadPackages(employeeIds: number[], executor: Executor = db): Promise<Map<number, PackageRow[]>> {
  const result = new Map<number, PackageRow[]>();
  if (!employeeIds.length) return result;
  const rows = await executor.select().from(salaryChanges)
    .where(inArray(salaryChanges.employeeId, employeeIds)).orderBy(asc(salaryChanges.effectiveFrom), asc(salaryChanges.id));
  const lines = rows.length
    ? await executor.select().from(salaryChangeLines).where(inArray(salaryChangeLines.changeId, rows.map((r) => r.id)))
    : [];
  const byChange = new Map<number, SalaryLine[]>();
  for (const line of lines) {
    const list = byChange.get(line.changeId) ?? [];
    list.push({ componentTypeId: line.componentTypeId, amount: line.amount });
    byChange.set(line.changeId, list);
  }
  for (const row of rows) {
    const list = result.get(row.employeeId) ?? [];
    list.push({
      id: row.id, employeeId: row.employeeId, effectiveFrom: row.effectiveFrom, cancelled: row.cancelledAt != null, origin: row.origin,
      reason: row.reason, createdByAccountId: row.createdByAccountId, proposedByAccountId: row.proposedByAccountId,
      createdAt: row.createdAt, requestId: row.requestId, cancelledAt: row.cancelledAt, cancelledByAccountId: row.cancelledByAccountId,
      cancelReason: row.cancelReason, lines: byChange.get(row.id) ?? [],
    });
    result.set(row.employeeId, list);
  }
  return result;
}

export type StandardKind = 'TRAINING' | 'EMPLOYEE';
export type StandardRow = {
  id: number; kind: StandardKind; effectiveFrom: IsoDate; cancelled: boolean; reason: string; createdByAccountId: number;
  createdAt: Date; cancelReason: string | null; lines: SalaryLine[];
};

export async function loadStandards(executor: Executor = db): Promise<StandardRow[]> {
  const rows = await executor.select().from(salaryStandards).orderBy(asc(salaryStandards.effectiveFrom), asc(salaryStandards.id));
  const lines = rows.length
    ? await executor.select().from(salaryStandardLines).where(inArray(salaryStandardLines.standardId, rows.map((r) => r.id)))
    : [];
  return rows.map((row) => ({
    id: row.id, kind: row.kind, effectiveFrom: row.effectiveFrom, cancelled: row.cancelledAt != null, reason: row.reason,
    createdByAccountId: row.createdByAccountId, createdAt: row.createdAt, cancelReason: row.cancelReason,
    lines: lines.filter((l) => l.standardId === row.id).map((l) => ({ componentTypeId: l.componentTypeId, amount: l.amount })),
  }));
}

/** Gaji Standar yang berlaku pada tanggal itu, atau null bila belum diisi. */
export function standardOn(standards: readonly StandardRow[], kind: StandardKind, date: IsoDate): StandardRow | null {
  return packageOn(standards.filter((s) => s.kind === kind), date);
}

export type PendingProposal = { requestId: number; employeeId: number; effectiveFrom: IsoDate; submittedByAccountId: number; deadlineOn: IsoDate };

export async function pendingProposals(employeeIds: number[] | null, executor: Executor = db): Promise<PendingProposal[]> {
  const rows = await executor.select({
    requestId: salaryChangeProposals.requestId, employeeId: salaryChangeProposals.employeeId, effectiveFrom: salaryChangeProposals.effectiveFrom,
    submittedByAccountId: salaryChangeProposals.proposedByAccountId, deadlineOn: salaryChangeProposals.deadlineOn,
  }).from(salaryChangeProposals).where(eq(salaryChangeProposals.state, 'OPEN'));
  return rows.filter((r) => !employeeIds || employeeIds.includes(r.employeeId));
}

/** Orang yang punya gaji bulanan (spec L4a §3.2) beserta tanda "gaji hanya terlihat Pemilik dan GM". */
export type PayrollPerson = PersonForModules & { ownerOnly: boolean; isOwnerPosition: boolean; isGmPosition: boolean };

async function positionFlags(positionIds: number[], today: IsoDate) {
  const flags = new Map<number, { monthly: boolean; ownerOnly: boolean }>();
  for (const positionId of new Set(positionIds)) {
    const [basis, ownerOnly] = await Promise.all([
      settingOn<string>('position.pay_basis', today, { positionId }),
      settingOn<string>('position.salary_owner_only', today, { positionId }),
    ]);
    flags.set(positionId, { monthly: basis === 'MONTHLY', ownerOnly: ownerOnly === 'YES' });
  }
  return flags;
}

export async function loadPayrollPeople(today: IsoDate = todayWib()): Promise<PayrollPerson[]> {
  const [people, org] = await Promise.all([listPeopleForModules(), getOrgLookup()]);
  const periodStart = periodStartOf(today);
  const flags = await positionFlags(people.map((p) => p.positionId), today);
  return people
    // Aktif hari ini, atau berhenti di periode berjalan (slip terakhirnya masih dibuat, GAJ-02).
    .filter((p) => p.activeToday || (p.lastStatus?.kind === 'DEACTIVATE' && p.lastStatus.effectiveOn >= periodStart))
    .filter((p) => flags.get(p.positionId)?.monthly)
    .map((p) => {
      const position = org.positions.find((pos) => pos.id === p.positionId);
      const name = position?.name.trim().toLowerCase() ?? '';
      return {
        ...p, ownerOnly: flags.get(p.positionId)?.ownerOnly ?? false,
        isOwnerPosition: !!position?.fullAccess && name === 'pemilik', isGmPosition: !!position?.fullAccess && name === 'gm',
      };
    });
}

/** Hak lihat gaji satu orang (GAJ-46, KAR-83): dijaga di server; orang bertanda tidak dikirim ke selain Pemilik/GM. */
export function canSeeSalary(actor: Actor | null, person: Pick<PayrollPerson, 'ownerOnly' | 'target'>): boolean {
  if (!actor) return false;
  if (person.ownerOnly && !actor.fullAccess) return false;
  return can(actor, 'salary.view', person.target) || can(actor, 'salary.change', person.target);
}

/** Pelaku boleh mengubah langsung gaji orang ini (GAJ-62): Pemilik/GM; atas dirinya sendiri hanya GM. */
export async function directChangeProblem(actor: Actor | null, person: Pick<PayrollPerson, 'id'>): Promise<string | null> {
  if (!actor || !actor.fullAccess) return 'Hanya Pemilik atau GM yang bisa mengubah gaji langsung.';
  if (actor.personId !== person.id) return null;
  const org = await getOrgLookup();
  const position = org.positions.find((p) => p.id === actor.positionId);
  return position?.name.trim().toLowerCase() === 'gm' ? null : 'Gaji Anda sendiri diubah oleh Pemilik lain atau GM.';
}

/** Nama orang per akun, untuk "oleh siapa" di riwayat. */
export async function accountNames(): Promise<Map<number, string>> {
  const people = await listPeopleForModules();
  const accounts = await activeHrisAccounts(people.map((p) => p.id));
  const names = new Map<number, string>();
  for (const person of people) {
    const accountId = accounts.get(person.id);
    if (accountId) names.set(accountId, person.name);
  }
  return names;
}

export async function accountOf(employeeId: number): Promise<number | null> {
  return (await activeHrisAccounts([employeeId])).get(employeeId) ?? null;
}

export async function dailyDivisor(on: IsoDate): Promise<number> {
  return Number(await settingOn('payroll.daily_divisor', on));
}

/**
 * Orang berslip bulanan untuk satu periode (GAJ-02, spec L4e §3.1): ditempatkan sekurang-kurangnya sehari di periode itu,
 * termasuk Training, Pemilik, GM, dan yang berhenti di periode itu. Tanda jabatan dibaca pada awal periode.
 */
export async function loadPeriodPeople(periodStart: IsoDate, periodEnd: IsoDate): Promise<PayrollPerson[]> {
  const [people, org] = await Promise.all([listPeopleForModules(), getOrgLookup()]);
  const placed = people.filter((p) => p.joinedOn <= periodEnd && !(p.lastStatus?.kind === 'DEACTIVATE' && p.lastStatus.effectiveOn <= periodStart)
    && (p.activeToday || p.lastStatus?.kind === 'DEACTIVATE'));
  const flags = await positionFlags(placed.map((p) => p.positionId), periodStart);
  return placed.filter((p) => flags.get(p.positionId)?.monthly).map((p) => {
    const position = org.positions.find((pos) => pos.id === p.positionId);
    const name = position?.name.trim().toLowerCase() ?? '';
    return {
      ...p, ownerOnly: flags.get(p.positionId)?.ownerOnly ?? false,
      isOwnerPosition: !!position?.fullAccess && name === 'pemilik', isGmPosition: !!position?.fullAccess && name === 'gm',
    };
  });
}
