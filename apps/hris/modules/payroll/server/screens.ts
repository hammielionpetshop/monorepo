import { can, hasAction, type Actor } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import {
  classifyChange, dailyRateLabel, effectiveChoices, longDate, monthlyTotal, packageOn, periodName, periodStartOf, scheduledAfter,
  type IsoDate, type SalaryLine,
} from '../rules/salary';
import {
  accountNames, canSeeSalary, dailyDivisor, directChangeProblem, loadPackages, loadPayrollPeople, loadStandards, loadTypes,
  pendingProposals, standardOn, type PackageRow, type StandardKind,
} from './data';
import { componentUsers } from './write';

export type SalaryListFilter = { branch?: string; position?: string; status?: string; flag?: string; q?: string };

export type SalaryListRow = {
  id: number; name: string; code: string; positionName: string; branchName: string; workStatus: 'TRAINING' | 'EMPLOYEE';
  total: number | null; daily: string | null; since: IsoDate | null; next: { total: number; from: IsoDate } | null;
  pendingProposal: boolean; missing: boolean;
};

const ORIGIN_LABELS: Record<PackageRow['origin'], string> = {
  DIRECT: 'Diubah langsung', PROPOSAL: 'Usulan disetujui', STANDARD_PROMOTION: 'Gaji Standar saat promosi',
};

/** GAJ-L01 Gaji Karyawan. Orang bertanda "Gaji hanya terlihat Pemilik dan GM" tidak dikirim ke HR (KAR-83). */
export async function salaryListScreen(actor: Actor | null, filter: SalaryListFilter = {}) {
  const today = todayWib();
  const [people, divisor] = await Promise.all([loadPayrollPeople(today), dailyDivisor(today)]);
  const visible = people.filter((p) => canSeeSalary(actor, p));
  const [packages, proposals] = await Promise.all([loadPackages(visible.map((p) => p.id)), pendingProposals(visible.map((p) => p.id))]);
  const periodStart = periodStartOf(today);
  const rows: SalaryListRow[] = visible.map((person) => {
    const list = packages.get(person.id) ?? [];
    const current = packageOn(list, today);
    const next = scheduledAfter(list, today)[0] ?? null;
    return {
      id: person.id, name: person.name, code: person.code, positionName: person.positionName, branchName: person.branchName,
      workStatus: person.workStatus,
      total: current ? monthlyTotal(current.lines) : null,
      daily: current ? dailyRateLabel(current.lines, divisor) : null,
      since: current?.effectiveFrom ?? null,
      next: next ? { total: monthlyTotal(next.lines), from: next.effectiveFrom } : null,
      pendingProposal: proposals.some((p) => p.employeeId === person.id),
      // Belum ada gaji = tanpa paket berlaku hari ini (awal periode selalu ≤ hari ini, jadi = periode berjalan).
      missing: !current,
    };
  });
  const q = filter.q?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const person = visible.find((p) => p.id === row.id)!;
    if (filter.branch && String(person.branchId) !== filter.branch) return false;
    if (filter.position && String(person.positionId) !== filter.position) return false;
    if (filter.status && person.workStatus !== filter.status) return false;
    if (filter.flag === 'missing' && !row.missing) return false;
    if (filter.flag === 'proposal' && !row.pendingProposal) return false;
    if (q && !row.name.toLowerCase().includes(q) && !row.code.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => Number(b.missing) - Number(a.missing) || a.name.localeCompare(b.name, 'id'));
  const branches = [...new Map(visible.map((p) => [p.branchId, p.branchName])).entries()].map(([id, name]) => ({ id, name }));
  const positions = [...new Map(visible.map((p) => [p.positionId, p.positionName])).entries()].map(([id, name]) => ({ id, name }));
  return {
    rows: filtered, branches, positions, divisor, periodName: periodName(periodStart),
    missingCount: rows.filter((r) => r.missing).length,
  };
}

/** Kartu Beranda "Belum ada gaji" (spec L4a §3.2): hanya untuk yang berhak melihat gaji. */
export async function missingSalaryCount(actor: Actor | null): Promise<number> {
  if (!hasAction(actor, 'salary.view') && !hasAction(actor, 'salary.change')) return 0;
  return (await salaryListScreen(actor)).missingCount;
}

export type HistoryCard = {
  id: number; effectiveFrom: IsoDate; total: number; lines: { name: string; amount: number }[]; origin: string; reason: string;
  by: string; proposedBy: string | null; at: string; cancelled: boolean; cancelReason: string | null; cancelledBy: string | null;
  state: 'ACTIVE' | 'SCHEDULED' | 'PAST' | 'CANCELLED'; canCancel: boolean;
};

const at = (date: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date);

/** GAJ-L02 Gaji Seseorang: gaji sekarang, perubahan terjadwal, riwayat. Null = tidak ada / tidak berhak (404). */
export async function salaryPersonScreen(actor: Actor | null, employeeId: number) {
  const today = todayWib();
  const people = await loadPayrollPeople(today);
  const person = people.find((p) => p.id === employeeId);
  if (!person || !canSeeSalary(actor, person)) return null;
  const [packages, types, names, divisor, proposals] = await Promise.all([
    loadPackages([person.id]), loadTypes(), accountNames(), dailyDivisor(today), pendingProposals([person.id]),
  ]);
  const typeName = new Map(types.map((t) => [t.id, { name: t.name, order: t.sortOrder }]));
  const list = packages.get(person.id) ?? [];
  const current = packageOn(list, today);
  const canChange = can(actor, 'salary.change', person.target) && !(await directChangeProblem(actor, person));
  const canPropose = !canChange && can(actor, 'salary.propose', person.target) && person.id !== actor?.personId;
  const named = (lines: SalaryLine[]) => lines
    .map((l) => ({ name: typeName.get(l.componentTypeId)?.name ?? `#${l.componentTypeId}`, amount: l.amount, order: typeName.get(l.componentTypeId)?.order ?? 99 }))
    .sort((a, b) => a.order - b.order).map(({ name, amount }) => ({ name, amount }));
  const history: HistoryCard[] = [...list].reverse().map((pkg) => {
    const state = pkg.cancelled ? 'CANCELLED' : pkg.id === current?.id ? 'ACTIVE' : pkg.effectiveFrom > today ? 'SCHEDULED' : 'PAST';
    return {
      id: pkg.id, effectiveFrom: pkg.effectiveFrom, total: monthlyTotal(pkg.lines), lines: named(pkg.lines), origin: ORIGIN_LABELS[pkg.origin],
      reason: pkg.reason, by: names.get(pkg.createdByAccountId) ?? 'Sistem', proposedBy: pkg.proposedByAccountId ? names.get(pkg.proposedByAccountId) ?? null : null,
      at: at(pkg.createdAt), cancelled: pkg.cancelled, cancelReason: pkg.cancelReason,
      cancelledBy: pkg.cancelledByAccountId ? names.get(pkg.cancelledByAccountId) ?? null : null,
      state, canCancel: canChange && state === 'SCHEDULED',
    };
  });
  return {
    person: { id: person.id, name: person.name, code: person.code, positionName: person.positionName, branchName: person.branchName, workStatus: person.workStatus },
    current: current ? { from: current.effectiveFrom, total: monthlyTotal(current.lines), daily: dailyRateLabel(current.lines, divisor), lines: named(current.lines) } : null,
    scheduled: history.filter((h) => h.state === 'SCHEDULED').reverse(),
    history,
    proposals: proposals.map((p) => ({ requestId: p.requestId, from: longDate(p.effectiveFrom), mine: p.submittedByAccountId === actor?.accountId })),
    canChange, canPropose, divisor,
  };
}

/** GAJ-L03 Ubah Gaji: pilihan tanggal, jenis aktif, isian awal (gaji yang berlaku, atau Gaji Standar). */
export async function salaryEditScreen(actor: Actor | null, employeeId: number, useStandard: boolean) {
  const base = await salaryPersonScreen(actor, employeeId);
  if (!base || (!base.canChange && !base.canPropose)) return null;
  const today = todayWib();
  const [packages, types, standards] = await Promise.all([loadPackages([employeeId]), loadTypes(), loadStandards()]);
  const list = packages.get(employeeId) ?? [];
  const choices = effectiveChoices(today).map((from, index) => {
    const before = packageOn(list, from);
    return { from, label: `${longDate(from)} (${periodName(from)}${index === 0 ? ', periode berjalan' : ''})`, current: index === 0, before: before ? before.lines : null };
  });
  const kind: StandardKind = base.person.workStatus === 'TRAINING' ? 'TRAINING' : 'EMPLOYEE';
  const standard = standardOn(standards, kind, today);
  const latest = list.filter((p) => !p.cancelled).at(-1);
  const startLines = useStandard && standard ? standard.lines : (latest?.lines ?? (standard?.lines ?? []));
  return {
    ...base,
    choices,
    types: types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })),
    startLines,
    standard: standard ? { kind, label: kind === 'TRAINING' ? 'Gaji Standar Training' : 'Gaji Standar Karyawan', lines: standard.lines } : null,
    usedStandard: useStandard && !!standard,
  };
}

/** Pratinjau periksa (langkah 4): jenis perubahan dihitung server. */
export function previewKind(before: SalaryLine[] | null, after: SalaryLine[]) {
  return classifyChange(before, after);
}

/** GAJ-L04 Jenis Komponen Gaji. */
export async function componentTypesScreen(actor: Actor | null) {
  const canManage = can(actor, 'salary_components.manage');
  if (!canManage && !hasAction(actor, 'salary.view')) return null;
  const types = await loadTypes();
  const usage = await Promise.all(types.map(async (t) => {
    const users = await componentUsers(t.id);
    // HR tidak boleh menyimpulkan orang bertanda dari nama; jumlah saja (spec L4a §3.7).
    return { id: t.id, count: users.length };
  }));
  return {
    canManage,
    rows: types.map((t) => ({ ...t, used: usage.find((u) => u.id === t.id)?.count ?? 0 })),
  };
}

/** GAJ-L05 Gaji Standar: dua paket, berlaku sekarang, terjadwal, riwayat. */
export async function standardsScreen(actor: Actor | null) {
  const canManage = can(actor, 'salary_standard.manage');
  if (!canManage && !hasAction(actor, 'salary.view')) return null;
  const today = todayWib();
  const [standards, types, names, people] = await Promise.all([loadStandards(), loadTypes(), accountNames(), loadPayrollPeople(today)]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const packages = (kind: StandardKind) => {
    const list = standards.filter((s) => s.kind === kind);
    const current = packageOn(list, today);
    return {
      kind,
      label: kind === 'TRAINING' ? 'Gaji Standar Training' : 'Gaji Standar Karyawan',
      current: current ? { from: current.effectiveFrom, total: monthlyTotal(current.lines), lines: current.lines.map((l) => ({ name: typeName.get(l.componentTypeId) ?? '', amount: l.amount })) } : null,
      history: [...list].reverse().map((s) => ({
        id: s.id, from: s.effectiveFrom, total: monthlyTotal(s.lines), cancelled: s.cancelled, cancelReason: s.cancelReason, reason: s.reason,
        by: names.get(s.createdByAccountId) ?? '—', at: at(s.createdAt),
        state: s.cancelled ? 'CANCELLED' : s.id === current?.id ? 'ACTIVE' : s.effectiveFrom > today ? 'SCHEDULED' : 'PAST',
        lines: s.lines.map((l) => ({ componentTypeId: l.componentTypeId, name: typeName.get(l.componentTypeId) ?? '', amount: l.amount })),
      })),
    };
  };
  return {
    canManage,
    packages: [packages('TRAINING'), packages('EMPLOYEE')],
    types: types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })),
    choices: effectiveChoices(today).map((from, index) => ({ from, label: `${longDate(from)}${index === 0 ? ' (periode berjalan)' : ''}` })),
    peopleCount: people.length,
  };
}
