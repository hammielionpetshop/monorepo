import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  salaryChangeLines, salaryChangeProposals, salaryChanges, salaryComponentTypeNames, salaryComponentTypes, salaryStandardLines, salaryStandards,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import {
  can, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx,
} from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import { checkReason } from '@/modules/settings';
import {
  classifyChange, cleanLines, effectiveChoices, effectiveDateProblem, isPeriodStart, linesProblem, longDate, monthlyTotal, packageOn,
  periodStartOf, promotionLines, proposalDeadline, rupiah, type IsoDate, type SalaryLine,
} from '../rules/salary';
import {
  accountOf, canSeeSalary, directChangeProblem, loadPackages, loadPayrollPeople, loadStandards, loadTypes, pendingProposals, standardOn,
  type Executor, type PayrollPerson, type StandardKind,
} from './data';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export type SalaryChangeInput = { employeeId: number; effectiveFrom: unknown; lines: unknown; reason: unknown };

const lockPerson = (tx: Tx, employeeId: number) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`salary:${employeeId}`}))`);

/** Paket yang berlaku di tanggal itu, dibaca di transaksi (sesudah dikunci). */
async function packageAt(executor: Executor, employeeId: number, date: IsoDate) {
  const packages = (await loadPackages([employeeId], executor)).get(employeeId) ?? [];
  return { packages, current: packageOn(packages, date) };
}

async function findPerson(employeeId: number): Promise<PayrollPerson | null> {
  return (await loadPayrollPeople()).find((p) => p.id === employeeId) ?? null;
}

type Checked = { person: PayrollPerson; effectiveFrom: IsoDate; lines: SalaryLine[]; reason: string; before: SalaryLine[] | null };

/** Pemeriksaan bersama ubah langsung dan usulan (spec L4a §3.3). */
async function checkChange(executor: Executor, input: SalaryChangeInput, person: PayrollPerson): Promise<Checked | Fail> {
  const types = await loadTypes(executor);
  const problem = linesProblem(input.lines, new Set(types.filter((t) => t.active).map((t) => t.id)));
  if (problem) return fail(400, problem);
  const lines = cleanLines(input.lines as SalaryLine[]);
  if (!isPeriodStart(input.effectiveFrom)) return fail(400, 'Perubahan gaji hanya bisa mulai tanggal 26 (awal periode).');
  const effectiveFrom = input.effectiveFrom;
  const { current } = await packageAt(executor, person.id, effectiveFrom);
  const before = current ? cleanLines(current.lines) : null;
  const dateProblem = effectiveDateProblem(effectiveFrom, todayWib(), classifyChange(before, lines));
  if (dateProblem) return fail(400, dateProblem);
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  return { person, effectiveFrom, lines, reason: reason.reason, before };
}

/** Tulis paket baru; paket lain di tanggal yang sama diganti (ditandai batal "diganti"). */
async function writePackage(tx: Tx, input: {
  employeeId: number; effectiveFrom: IsoDate; lines: SalaryLine[]; origin: 'DIRECT' | 'PROPOSAL' | 'STANDARD_PROMOTION'; reason: string;
  actorAccountId: number; proposedByAccountId?: number | null; requestId?: number | null;
}): Promise<number> {
  const now = new Date();
  const replaced = await tx.update(salaryChanges).set({
    cancelledAt: now, cancelledByAccountId: input.actorAccountId, cancelReason: 'Diganti perubahan baru di tanggal yang sama.',
  }).where(and(eq(salaryChanges.employeeId, input.employeeId), eq(salaryChanges.effectiveFrom, input.effectiveFrom), isNull(salaryChanges.cancelledAt)))
    .returning({ id: salaryChanges.id });
  const [row] = await tx.insert(salaryChanges).values({
    employeeId: input.employeeId, effectiveFrom: input.effectiveFrom, origin: input.origin, reason: input.reason,
    createdByAccountId: input.actorAccountId, proposedByAccountId: input.proposedByAccountId ?? null, requestId: input.requestId ?? null,
  }).returning({ id: salaryChanges.id });
  await tx.insert(salaryChangeLines).values(input.lines.map((line) => ({ changeId: row.id, ...line })));
  await recordAudit(tx, {
    actorAccountId: input.actorAccountId, entity: 'salary_change', entityId: row.id, action: 'salary.schedule',
    before: replaced.length ? { replaced: replaced.map((r) => r.id) } : null,
    after: { employeeId: input.employeeId, effectiveFrom: input.effectiveFrom, origin: input.origin, lines: input.lines, requestId: input.requestId ?? null },
    reason: input.reason,
  });
  return row.id;
}

async function tellEmployee(tx: Tx, employeeId: number, title: string, entityId: number, actorAccountId: number | null) {
  const account = await accountOf(employeeId);
  if (account) await notify(tx, [account], { kind: 'salary.changed', title, entity: 'salary_change', entityId }, actorAccountId);
}

/** GAJ-L03 oleh Pemilik/GM: langsung terjadwal; orangnya dan pemilik lain diberi tahu (GAJ-62, KAR-73). */
export async function changeSalary(actor: Actor | null, input: SalaryChangeInput, announce: ChangeAnnounce)
  : Promise<ServiceResult<{ id: number; message: string }>> {
  const person = await findPerson(input.employeeId);
  if (!person || !canSeeSalary(actor, person)) return fail(404, 'Orang ini tidak ditemukan di daftar gaji bulanan.');
  if (!can(actor, 'salary.change', person.target)) return fail(403, 'Anda hanya bisa mengusulkan perubahan gaji.');
  const blocked = await directChangeProblem(actor, person);
  if (blocked) return fail(403, blocked);
  return db.transaction(async (tx) => {
    await lockPerson(tx, person.id);
    const checked = await checkChange(tx, input, person);
    if ('ok' in checked) return checked;
    const id = await writePackage(tx, {
      employeeId: person.id, effectiveFrom: checked.effectiveFrom, lines: checked.lines, origin: 'DIRECT', reason: checked.reason,
      actorAccountId: actor!.accountId,
    });
    const when = longDate(checked.effectiveFrom);
    await tellEmployee(tx, person.id, `Gaji Anda berubah mulai ${when}.`, id, actor!.accountId);
    await announce(tx, actor!.accountId, { what: `mengubah gaji ${person.name} mulai ${when}`, link: `/gaji/${person.id}`, entity: 'salary_change', entityId: id });
    const self = person.id === actor!.personId;
    return {
      ok: true as const,
      data: { id, message: `Gaji ${person.name} mulai ${when} menjadi ${rupiah(monthlyTotal(checked.lines))}. ${self ? 'Para pemilik diberi tahu.' : `${person.name} diberi tahu.`}` },
    };
  });
}

/** Batalkan perubahan yang belum berlaku (alasan wajib). */
export async function cancelSalaryChange(actor: Actor | null, changeId: number, reasonInput: unknown, announce: ChangeAnnounce)
  : Promise<ServiceResult<{ id: number }>> {
  const reason = await checkReason(reasonInput);
  if (!reason.ok) return fail(400, reason.error);
  const [row] = await db.select().from(salaryChanges).where(eq(salaryChanges.id, changeId));
  const person = row ? await findPerson(row.employeeId) : null;
  if (!row || !person || !canSeeSalary(actor, person)) return fail(404, 'Perubahan gaji tidak ditemukan.');
  if (!can(actor, 'salary.change', person.target)) return fail(403, 'Hanya Pemilik atau GM yang bisa membatalkan perubahan gaji.');
  const blocked = await directChangeProblem(actor, person);
  if (blocked) return fail(403, blocked);
  return db.transaction(async (tx) => {
    await lockPerson(tx, person.id);
    const [fresh] = await tx.select().from(salaryChanges).where(eq(salaryChanges.id, changeId));
    if (fresh.cancelledAt) return fail(409, 'Perubahan ini sudah dibatalkan.');
    if (fresh.effectiveFrom <= todayWib()) return fail(409, 'Perubahan ini sudah berlaku dan tidak bisa dibatalkan. Ubah gaji lagi untuk periode berikutnya.');
    await tx.update(salaryChanges).set({ cancelledAt: new Date(), cancelledByAccountId: actor!.accountId, cancelReason: reason.reason })
      .where(eq(salaryChanges.id, changeId));
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'salary_change', entityId: changeId, action: 'salary.cancel',
      before: { cancelled: false }, after: { cancelled: true }, reason: reason.reason,
    });
    const when = longDate(fresh.effectiveFrom);
    await tellEmployee(tx, person.id, `Perubahan gaji Anda mulai ${when} dibatalkan.`, changeId, actor!.accountId);
    if (fresh.proposedByAccountId) {
      await notify(tx, [fresh.proposedByAccountId], {
        kind: 'salary.cancelled', title: `Perubahan gaji ${person.name} mulai ${when} dibatalkan.`, body: `Alasan: ${reason.reason}`,
        link: `/gaji/${person.id}`, entity: 'salary_change', entityId: changeId,
      }, actor!.accountId);
    }
    await announce(tx, actor!.accountId, {
      what: `membatalkan perubahan gaji ${person.name} mulai ${when}`, link: `/gaji/${person.id}`, entity: 'salary_change', entityId: changeId,
    });
    return { ok: true as const, data: { id: changeId } };
  });
}

// ---------- Usulan ubah gaji (Mesin Pengajuan) ----------

type ProposalLine = SalaryLine;

async function loadProposal(executor: Executor, requestId: number) {
  const [row] = await executor.select().from(salaryChangeProposals).where(eq(salaryChangeProposals.requestId, requestId));
  return row ?? null;
}

async function typeNames(executor: Executor = db): Promise<Map<number, string>> {
  return new Map((await loadTypes(executor)).map((t) => [t.id, t.name]));
}

/**
 * Isi khas pengajuan "Usulan ubah gaji" (GAJ-62, spec L4a §3.4). Orang yang diajukan = pengusul (HR), supaya orang
 * yang gajinya diusulkan tidak melihat usulannya; orang sasarannya disimpan di tabel usulan.
 */
export function salaryChangeHandler(announce: ChangeAnnounce) {
  return {
    async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM mengubah gaji langsung dari halaman gaji.');
      const employeeId = Number(input.employeeId);
      if (employeeId === actor.personId) return fail(403, 'Gaji Anda sendiri tidak bisa Anda usulkan.');
      const person = await findPerson(employeeId);
      if (!person || !canSeeSalary(actor, person)) return fail(404, 'Orang ini tidak ditemukan di daftar gaji bulanan.');
      await lockPerson(tx, employeeId);
      const checked = await checkChange(tx, { employeeId, effectiveFrom: input.effectiveFrom, lines: input.lines, reason: input.reason }, person);
      if ('ok' in checked) return checked;
      const open = await pendingProposals([employeeId], tx);
      if (open.some((p) => p.effectiveFrom === checked.effectiveFrom)) {
        return fail(409, 'Sudah ada usulan yang menunggu untuk orang ini di tanggal itu. Tarik dulu usulan itu.');
      }
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Usulan ubah gaji ${person.name} mulai ${longDate(checked.effectiveFrom)}`,
          dedupeKey: `salary_change:${employeeId}:${checked.effectiveFrom}`,
          requiredAttachment: null,
          save: async (saveTx: Tx, requestId: number) => {
            await saveTx.insert(salaryChangeProposals).values({
              requestId, employeeId, effectiveFrom: checked.effectiveFrom, lines: checked.lines, beforeLines: checked.before,
              reason: checked.reason, deadlineOn: proposalDeadline(checked.effectiveFrom), proposedByAccountId: actor.accountId,
            });
          },
        },
      };
    },

    async apply(tx: Tx, actorAccountId: number, requestId: number) {
      const proposal = await loadProposal(tx, requestId);
      if (!proposal || proposal.state !== 'OPEN') return fail(404, 'Usulan tidak ditemukan.');
      if ((await accountOf(proposal.employeeId)) === actorAccountId) return fail(403, 'Usulan atas gaji Anda sendiri diputuskan pemilik lain.');
      const today = todayWib();
      if (today > proposal.deadlineOn) return fail(409, 'Batas usulan ini sudah lewat. Tolak, lalu ajukan ulang untuk periode lain.');
      await lockPerson(tx, proposal.employeeId);
      const lines = cleanLines(proposal.lines as ProposalLine[]);
      const { current } = await packageAt(tx, proposal.employeeId, proposal.effectiveFrom);
      const kind = classifyChange(current ? current.lines : null, lines);
      // Periode berjalan saat diajukan boleh tetap dipakai sampai batas (slip belum ada); penurunan tetap hanya periode depan.
      if (kind === 'CUT' && proposal.effectiveFrom <= periodStartOf(today)) {
        return fail(409, 'Penurunan gaji hanya bisa mulai periode depan. Tolak, lalu ajukan ulang.');
      }
      if (kind === 'SAME') return fail(409, 'Gaji di tanggal itu sudah sama dengan usulan; tidak ada yang berubah. Tolak usulan ini.');
      const types = await loadTypes(tx);
      if (lines.some((l) => !types.find((t) => t.id === l.componentTypeId)?.active)) {
        return fail(409, 'Ada jenis komponen yang sudah nonaktif. Tolak, lalu ajukan ulang.');
      }
      const person = await findPerson(proposal.employeeId);
      const id = await writePackage(tx, {
        employeeId: proposal.employeeId, effectiveFrom: proposal.effectiveFrom, lines, origin: 'PROPOSAL', reason: proposal.reason,
        actorAccountId, proposedByAccountId: proposal.proposedByAccountId, requestId,
      });
      await tx.update(salaryChangeProposals).set({ state: 'APPROVED', salaryChangeId: id }).where(eq(salaryChangeProposals.id, proposal.id));
      const when = longDate(proposal.effectiveFrom);
      await tellEmployee(tx, proposal.employeeId, `Gaji Anda berubah mulai ${when}.`, id, actorAccountId);
      const name = person?.name ?? 'karyawan';
      await announce(tx, actorAccountId, { what: `menyetujui usulan ubah gaji ${name} mulai ${when}`, link: `/persetujuan/${requestId}`, entity: 'salary_change', entityId: id });
      return { ok: true as const, effect: `Gaji ${name} mulai ${when} menjadi ${rupiah(monthlyTotal(lines))}. ${name} diberi tahu.` };
    },

    async close(tx: Tx, _actorAccountId: number, requestId: number) {
      await tx.update(salaryChangeProposals).set({ state: 'CLOSED' })
        .where(and(eq(salaryChangeProposals.requestId, requestId), eq(salaryChangeProposals.state, 'OPEN')));
    },

    async effectPreview(requestId: number) {
      const proposal = await loadProposal(db, requestId);
      if (!proposal) return 'Usulan ini akan disetujui.';
      const person = await findPerson(proposal.employeeId);
      return `Gaji ${person?.name ?? 'orang ini'} mulai ${longDate(proposal.effectiveFrom)} menjadi ${rupiah(monthlyTotal(proposal.lines as ProposalLine[]))}. Orangnya diberi tahu tanpa nominal.`;
    },

    async describe(requestId: number) {
      const proposal = await loadProposal(db, requestId);
      if (!proposal) return [];
      const [person, names] = await Promise.all([findPerson(proposal.employeeId), typeNames()]);
      const before = new Map(((proposal.beforeLines as ProposalLine[] | null) ?? []).map((l) => [l.componentTypeId, l.amount]));
      const after = new Map((proposal.lines as ProposalLine[]).map((l) => [l.componentTypeId, l.amount]));
      const ids = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b);
      const show = (amount: number | undefined) => (amount == null ? '—' : rupiah(amount));
      return [
        { label: 'Karyawan', before: null, after: person ? `${person.name} (${person.positionName}, ${person.branchName})` : `#${proposal.employeeId}` },
        { label: 'Mulai berlaku', before: null, after: longDate(proposal.effectiveFrom) },
        ...ids.map((id) => ({ label: names.get(id) ?? `Komponen #${id}`, before: show(before.get(id)), after: show(after.get(id)) })),
        {
          label: 'Gaji tetap sebulan',
          before: proposal.beforeLines ? rupiah(monthlyTotal(proposal.beforeLines as ProposalLine[])) : 'Belum ada gaji',
          after: rupiah(monthlyTotal(proposal.lines as ProposalLine[])),
        },
        { label: 'Alasan', before: null, after: proposal.reason },
        { label: 'Batas diputuskan', before: null, after: longDate(proposal.deadlineOn) },
      ];
    },

    async resubmitValues(requestId: number) {
      const proposal = await loadProposal(db, requestId);
      if (!proposal) return null;
      return { employeeId: proposal.employeeId, effectiveFrom: proposal.effectiveFrom, lines: proposal.lines, reason: proposal.reason };
    },
  };
}

/** Usulan yang lewat batas (spec L4a §3.4). Dipanggil mesin `salary-proposal-expire` dengan fungsi hangus Mesin Pengajuan. */
export async function expireSalaryProposals(
  expire: (tx: Tx, requestId: number, reason: string) => Promise<boolean>,
): Promise<{ expired: number }> {
  const today = todayWib();
  const due = (await pendingProposals(null)).filter((p) => p.deadlineOn < today);
  let expired = 0;
  for (const proposal of due) {
    const done = await db.transaction((tx) => expire(tx, proposal.requestId,
      `Usulan ubah gaji mulai ${longDate(proposal.effectiveFrom)} tidak diputuskan sampai ${longDate(proposal.deadlineOn)}.`));
    if (done) expired += 1;
  }
  return { expired };
}

// ---------- Jenis komponen (GAJ-L04) ----------

function cleanName(value: unknown): string | null {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return name.length >= 2 && name.length <= 60 ? name : null;
}

function isUnique(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  return (cause as { code?: string })?.code === '23505';
}

export async function saveComponentType(actor: Actor | null, input: { id?: number; name: unknown; sortOrder: unknown })
  : Promise<ServiceResult<{ id: number }>> {
  if (!can(actor, 'salary_components.manage')) return fail(403, 'Hanya Pemilik atau GM yang bisa mengubah jenis komponen gaji.');
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nama jenis komponen 2–60 huruf.');
  const sortOrder = Number(input.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 99) return fail(400, 'Urutan tampil 1–99.');
  try {
    return await db.transaction(async (tx) => {
      if (input.id) {
        const [old] = await tx.select().from(salaryComponentTypes).where(eq(salaryComponentTypes.id, input.id));
        if (!old) return fail(404, 'Jenis komponen tidak ditemukan.');
        await tx.update(salaryComponentTypes).set({ name, sortOrder, updatedAt: new Date() }).where(eq(salaryComponentTypes.id, old.id));
        if (old.name !== name) {
          await tx.insert(salaryComponentTypeNames).values({ componentTypeId: old.id, oldName: old.name, newName: name, changedByAccountId: actor!.accountId });
        }
        await recordAudit(tx, {
          actorAccountId: actor!.accountId, entity: 'salary_component_type', entityId: old.id, action: 'update',
          before: { name: old.name, sortOrder: old.sortOrder }, after: { name, sortOrder },
        });
        return { ok: true as const, data: { id: old.id } };
      }
      const [row] = await tx.insert(salaryComponentTypes).values({ name, sortOrder, createdByAccountId: actor!.accountId }).returning({ id: salaryComponentTypes.id });
      await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'salary_component_type', entityId: row.id, action: 'create', after: { name, sortOrder } });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    if (isUnique(error)) return fail(409, 'Nama jenis komponen itu sudah ada.');
    throw error;
  }
}

/** Nonaktifkan ditolak selama ada paket berlaku atau terjadwal yang memakainya (GAJ-65). */
export async function setComponentTypeActive(actor: Actor | null, id: number, active: boolean): Promise<ServiceResult<{ id: number }>> {
  if (!can(actor, 'salary_components.manage')) return fail(403, 'Hanya Pemilik atau GM yang bisa mengubah jenis komponen gaji.');
  const [row] = await db.select().from(salaryComponentTypes).where(eq(salaryComponentTypes.id, id));
  if (!row) return fail(404, 'Jenis komponen tidak ditemukan.');
  if (!active) {
    const users = await componentUsers(id);
    if (users.length) return fail(409, `Jenis ini masih dipakai gaji ${users.join(', ')}. Hentikan komponennya di gaji mereka dulu.`);
  }
  await db.transaction(async (tx) => {
    await tx.update(salaryComponentTypes).set({ active, updatedAt: new Date() }).where(eq(salaryComponentTypes.id, id));
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'salary_component_type', entityId: id, action: active ? 'activate' : 'deactivate',
      before: { active: row.active }, after: { active },
    });
  });
  return { ok: true as const, data: { id } };
}

/** Nama orang yang paket berlaku hari ini atau terjadwalnya memakai jenis ini. */
export async function componentUsers(componentTypeId: number): Promise<string[]> {
  const people = await loadPayrollPeople();
  const packages = await loadPackages(people.map((p) => p.id));
  const today = todayWib();
  return people.filter((person) => {
    const list = packages.get(person.id) ?? [];
    const relevant = [packageOn(list, today), ...list.filter((p) => !p.cancelled && p.effectiveFrom > today)].filter(Boolean);
    return relevant.some((pkg) => pkg!.lines.some((l) => l.componentTypeId === componentTypeId));
  }).map((p) => p.name);
}

// ---------- Gaji Standar (GAJ-L05) ----------

export async function saveStandard(actor: Actor | null, input: { kind: unknown; effectiveFrom: unknown; lines: unknown; reason: unknown })
  : Promise<ServiceResult<{ id: number }>> {
  if (!can(actor, 'salary_standard.manage')) return fail(403, 'Hanya Pemilik atau GM yang bisa mengubah Gaji Standar.');
  if (input.kind !== 'TRAINING' && input.kind !== 'EMPLOYEE') return fail(400, 'Paket Gaji Standar tidak dikenal.');
  const kind: StandardKind = input.kind;
  const types = await loadTypes();
  const problem = linesProblem(input.lines, new Set(types.filter((t) => t.active).map((t) => t.id)));
  if (problem) return fail(400, problem);
  const lines = cleanLines(input.lines as SalaryLine[]);
  const today = todayWib();
  if (!isPeriodStart(input.effectiveFrom) || !effectiveChoices(today).includes(input.effectiveFrom)) {
    return fail(400, 'Gaji Standar mulai tanggal 26: periode berjalan atau sampai 3 periode depan.');
  }
  const effectiveFrom = input.effectiveFrom;
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`salary_standard:${kind}`}))`);
    const replaced = await tx.update(salaryStandards).set({
      cancelledAt: new Date(), cancelledByAccountId: actor!.accountId, cancelReason: 'Diganti paket baru di tanggal yang sama.',
    }).where(and(eq(salaryStandards.kind, kind), eq(salaryStandards.effectiveFrom, effectiveFrom), isNull(salaryStandards.cancelledAt)))
      .returning({ id: salaryStandards.id });
    const [row] = await tx.insert(salaryStandards).values({ kind, effectiveFrom, reason: reason.reason, createdByAccountId: actor!.accountId })
      .returning({ id: salaryStandards.id });
    await tx.insert(salaryStandardLines).values(lines.map((line) => ({ standardId: row.id, ...line })));
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'salary_standard', entityId: row.id, action: 'save',
      before: replaced.length ? { replaced: replaced.map((r) => r.id) } : null, after: { kind, effectiveFrom, lines }, reason: reason.reason,
    });
    return { ok: true as const, data: { id: row.id } };
  });
}

/**
 * Promosi Training disetujui (GAJ-64): jadwalkan Gaji Standar Karyawan di tanggal promosinya, komponen lain dibawa.
 * Tanpa usulan terpisah. Paket Karyawan kosong atau orangnya belum ada gaji → HR diberi tahu, tidak ada yang dijadwalkan.
 */
export async function schedulePromotionSalary(tx: Tx, event: { employeeId: number; effectiveOn: IsoDate; actorAccountId: number }): Promise<void> {
  const people = await loadPayrollPeople();
  const person = people.find((p) => p.id === event.employeeId);
  if (!person) return;
  await lockPerson(tx, person.id);
  const standard = standardOn(await loadStandards(tx), 'EMPLOYEE', event.effectiveOn);
  const { current } = await packageAt(tx, person.id, event.effectiveOn);
  if (!standard || !current) {
    const hr = await activeHrisAccounts(await listEmployeesWithAnyAction(['salary.view']));
    const why = !standard ? 'Gaji Standar Karyawan belum diisi' : 'orang ini belum punya gaji';
    await notify(tx, [...hr.values()], {
      kind: 'salary.promotion', title: `${person.name} naik menjadi Karyawan mulai ${longDate(event.effectiveOn)}, tetapi ${why}.`,
      body: 'Gajinya tidak diubah otomatis. Isi lewat Ubah Gaji.', link: `/gaji/${person.id}`, entity: 'employee', entityId: person.id,
    }, event.actorAccountId);
    return;
  }
  const lines = promotionLines(current.lines, standard.lines);
  if (classifyChange(current.lines, lines) === 'SAME') return;
  const id = await writePackage(tx, {
    employeeId: person.id, effectiveFrom: event.effectiveOn, lines, origin: 'STANDARD_PROMOTION',
    reason: 'Promosi Training disetujui: Gaji Standar Karyawan.', actorAccountId: event.actorAccountId,
  });
  await tellEmployee(tx, person.id, `Gaji Anda berubah mulai ${longDate(event.effectiveOn)}.`, id, event.actorAccountId);
}

/** Mesin `salary-proposal-expire` (04.40 WIB, spec L4a §6). `close` handler tidak memakai pengumuman. */
export async function runSalaryProposalExpire(): Promise<{ expired: number }> {
  const { expireRequest } = await import('@/modules/requests');
  const handler = salaryChangeHandler(async () => {});
  return expireSalaryProposals((tx, requestId, reason) => expireRequest(tx, requestId, reason, handler));
}
