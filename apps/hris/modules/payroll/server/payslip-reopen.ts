import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  bonusEntries, deductionCarryovers, fundEntries, otherReceivables, payslipLines, payslipSteps, payslips,
} from '@petshop/hris-db/schema/payroll';
import { requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import { getOrgLookup, hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { GROUP_LABELS, type DeductionGroup } from '../rules/deductions';
import { reasonProblem, reversalMovements } from '../rules/payslip';
import { rupiah } from '../rules/salary';
import { accountNames, loadPayrollPeople, type Executor, type PayrollPerson } from './data';
import { lockFunds, readFundState } from './funds';
import { cancelWaitingClaims, offSlipReopenBlock, settledByReceivable } from './off-slip';
import { cancelZeroPayment, paidReopenBlock } from './payment';
import { canSeeSlip, earlyCloseProblem, lastSlipOf, loadSlip, periodLabel, wibTime, type SlipRow } from './payslip';

// L4e-2 (spec L4e §3.7): Buka kembali slip (Pemilik/GM langsung, HR lewat pengajuan `payslip_reopen`), riwayat versi,
// Piutang Lain dan Hapuskan. Pembalikan dikerjakan satu transaksi; nomor slip tetap, versi bertambah saat ditutup lagi.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export const RECEIVABLE_STATUS_LABELS = { OPEN: 'Terbuka', WRITTEN_OFF: 'Dihapuskan', REVERSED: 'Dibalik (slip dibuka kembali)', SETTLED: 'Lunas (dipotong bayar di luar slip)' } as const;
export type ReceivableStatus = keyof typeof RECEIVABLE_STATUS_LABELS;

/** Sebab buka kembali ditolak (GAJ-95); null = boleh. */
export async function reopenBlock(slip: SlipRow, executor: Executor = db): Promise<string | null> {
  if (slip.status !== 'CLOSED') return 'Slip ini belum ditutup.';
  const paid = await paidReopenBlock(slip.id, executor);
  if (paid) return paid;
  if (slip.lastSlip) {
    const outside = await offSlipReopenBlock(slip.employeeId, executor);
    if (outside) return outside;
  }
  const [next] = await executor.select({ id: payslips.id }).from(payslips)
    .where(and(eq(payslips.employeeId, slip.employeeId), eq(payslips.kind, slip.kind), gt(payslips.periodStart, slip.periodStart), eq(payslips.status, 'CLOSED'))).limit(1);
  if (next) return 'Slip periode berikutnya orang ini sudah ditutup. Buka kembali slip itu lebih dulu.';
  const [changed] = await executor.select({ id: otherReceivables.id }).from(otherReceivables)
    .where(and(eq(otherReceivables.payslipId, slip.id), eq(otherReceivables.status, 'WRITTEN_OFF'))).limit(1);
  if (changed) return 'Piutang Lain dari slip ini sudah dihapuskan, jadi slip tidak bisa dibuka kembali.';
  return null;
}

/** Slip sendiri: hanya GM yang boleh membuka slipnya sendiri; Pemilik tidak (GAJ-95). */
async function ownSlipProblem(actor: Pick<Actor, 'personId' | 'positionId'>, person: PayrollPerson): Promise<string | null> {
  if (actor.personId !== person.id) return null;
  const position = (await getOrgLookup()).positions.find((p) => p.id === actor.positionId);
  return position?.name.trim().toLowerCase() === 'gm' ? null : 'Slip Anda sendiri dibuka kembali Pemilik lain atau GM.';
}

/** Balik langkah tutup 3–7 dalam satu transaksi (spec L4e §3.7). */
async function reopenInTx(
  tx: Tx, actorAccountId: number, slipId: number, reason: string, announce: ChangeAnnounce, via: { requestId: number } | null,
): Promise<{ ok: true; effect: string } | Fail> {
  const [locked] = await tx.select().from(payslips).where(eq(payslips.id, slipId)).for('update');
  if (!locked) return fail(404, 'Slip tidak ditemukan.');
  const block = await reopenBlock(locked, tx);
  if (block) return fail(409, block);
  await lockFunds(tx);
  const born = await tx.select().from(deductionCarryovers).where(eq(deductionCarryovers.fromPayslipId, locked.id));
  if (born.some((c) => c.status === 'TAKEN')) return fail(409, 'Sisa potongan dari slip ini sudah terpotong di slip lain. Buka kembali slip itu lebih dulu.');
  const now = new Date();
  const number = locked.number!;

  await tx.update(payslipLines).set({ status: 'REPLACED' })
    .where(and(eq(payslipLines.payslipId, locked.id), eq(payslipLines.version, locked.version), eq(payslipLines.status, 'ACTIVE')));
  await tx.update(deductionCarryovers).set({ status: 'CANCELLED' })
    .where(and(eq(deductionCarryovers.fromPayslipId, locked.id), eq(deductionCarryovers.status, 'CARRIED')));
  const restored = await tx.update(deductionCarryovers).set({ status: 'CARRIED', takenInPayslipId: null })
    .where(and(eq(deductionCarryovers.takenInPayslipId, locked.id), eq(deductionCarryovers.status, 'TAKEN'))).returning({ id: deductionCarryovers.id });
  // Buku dana hanya tambah: pembalik = baris SLIP lawan jumlah mutasi slip ini per dana.
  const entries = await tx.select({ fund: fundEntries.fund, amount: fundEntries.amount }).from(fundEntries).where(eq(fundEntries.payslipId, locked.id));
  const reversal = reversalMovements(entries.map((e) => ({ fund: e.fund as 'DISCIPLINE' | 'ABSENCE', amount: e.amount })), number);
  if (reversal.length) {
    await tx.insert(fundEntries).values(reversal.map((m) => ({
      fund: m.fund, kind: 'SLIP', amount: m.amount, branchId: locked.branchId, periodStart: locked.periodStart, reason: m.reason,
      payslipId: locked.id, createdByAccountId: actorAccountId,
    })));
  }
  const bonuses = await tx.update(bonusEntries).set({ status: 'APPROVED', payslipId: null })
    .where(and(eq(bonusEntries.payslipId, locked.id), inArray(bonusEntries.status, ['IN_SLIP', 'FORFEITED']))).returning({ id: bonusEntries.id });
  const receivables = await tx.update(otherReceivables).set({ status: 'REVERSED', decidedAt: now, decidedByAccountId: actorAccountId })
    .where(and(eq(otherReceivables.payslipId, locked.id), eq(otherReceivables.status, 'OPEN'))).returning({ id: otherReceivables.id });
  // Slip Rp0 yang Dibayar tanpa uang: pembayarannya ikut dibatalkan (GAJ-102, spec L4f §3.2).
  const zeroCancelled = await cancelZeroPayment(tx, locked.id, actorAccountId, reason);
  // Tagihan luar slip yang masih Menunggu dibatalkan: isinya kembali masuk slip ini (spec L4f §3.7).
  if (locked.lastSlip) await cancelWaitingClaims(tx, locked.employeeId, `Slip ${locked.number} dibuka kembali`);
  await tx.update(payslips).set({ status: 'ESTIMATE', closedAt: null, closedByAccountId: null, objectionUntil: null }).where(eq(payslips.id, locked.id));

  const person = (await loadPayrollPeople()).find((p) => p.id === locked.employeeId);
  const name = person?.name ?? `#${locked.employeeId}`;
  const summary = {
    number, name, version: locked.version, net: locked.net, requestId: via?.requestId ?? null,
    funds: reversal.map((m) => ({ fund: m.fund, amount: m.amount })), bonuses: bonuses.length, carries: restored.length, receivables: receivables.length, zeroPaymentCancelled: zeroCancelled,
  };
  await tx.insert(payslipSteps).values({ payslipId: locked.id, periodStart: locked.periodStart, action: 'REOPEN', reason, summary, actorAccountId });
  await recordAudit(tx, { actorAccountId, entity: 'payslip', entityId: locked.id, action: 'payslip.reopen', before: { status: 'CLOSED', version: locked.version }, after: summary, reason });
  const account = (await activeHrisAccounts([locked.employeeId])).get(locked.employeeId);
  if (account) {
    await notify(tx, [account], {
      kind: 'payslip.reopened', title: `Slip ${number} periode ${periodLabel(locked.periodStart)} sedang dibetulkan.`, body: `Alasan: ${reason}`,
      entity: 'payslip', entityId: locked.id,
    }, actorAccountId);
  }
  await announce(tx, actorAccountId, { what: `membuka kembali slip ${number} ${name}: ${reason}`, link: `/gaji/slip/${locked.id}`, entity: 'payslip', entityId: locked.id });
  // Bonus bersumber Dana Disiplin kembali Terpesan: Tersedia boleh minus, Pemilik/GM diberi tahu (spec L4e §7).
  const state = await readFundState(tx);
  let fundNote = '';
  if (state.discipline.available < 0) {
    fundNote = ` Tersedia Dana Disiplin kini minus ${rupiah(-state.discipline.available)}.`;
    await announce(tx, actorAccountId, { what: `membuka kembali slip ${number}; Tersedia Dana Disiplin minus ${rupiah(-state.discipline.available)}`, link: '/dana', entity: 'payslip', entityId: locked.id });
  }
  return {
    ok: true,
    effect: `Slip ${number} ${name} kembali Perkiraan. Mutasi dana dibalik, ${bonuses.length} baris bonus kembali Disahkan, ${restored.length} sisa potongan kembali Dibawa.${fundNote} ${name} diberi tahu.`,
  };
}

/** Pemilik/GM membuka kembali langsung (GAJ-95): alasan ≥ 15 huruf, ditahan 3 detik di layar. */
export async function reopenSlip(actor: Actor | null, slipId: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<{ effect: string }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'payslip.reopen')) return fail(403, 'Hanya Pemilik atau GM yang membuka kembali slip; HR memakai Minta buka kembali.');
  const loaded = await loadSlip(slipId);
  if (!loaded || !canSeeSlip(actor, loaded.person)) return fail(404, 'Slip tidak ditemukan.');
  const own = await ownSlipProblem(actor, loaded.person);
  if (own) return fail(403, own);
  const reason = String(reasonInput ?? '').trim();
  const problem = reasonProblem(reason);
  if (problem) return fail(400, problem);
  const done = await db.transaction((tx) => reopenInTx(tx, actor.accountId, slipId, reason, announce, null));
  return done.ok ? { ok: true, data: { effect: done.effect } } : done;
}

async function requestStep(executor: Executor, requestId: number) {
  const [row] = await executor.select().from(payslipSteps)
    .where(and(eq(payslipSteps.action, 'REOPEN_REQUEST'), sql`(${payslipSteps.summary} ->> 'requestId')::int = ${requestId}`)).limit(1);
  return row ?? null;
}

/** HR: Minta buka kembali lewat kotak Persetujuan; diputus Pemilik/GM (jenis `payslip_reopen`). */
export function payslipReopenHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(_tx, actor, input) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM membuka kembali slip langsung.');
      const loaded = await loadSlip(Number(input.slipId));
      if (!loaded || !canSeeSlip(actor, loaded.person)) return fail(404, 'Slip tidak ditemukan.');
      const { slip, person } = loaded;
      const reason = String(input.reason ?? '').trim();
      const problem = reasonProblem(reason) ?? (await reopenBlock(slip));
      if (problem) return fail(problem.startsWith('Alasan') ? 400 : 409, problem);
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Buka kembali slip ${slip.number} ${person.name} (periode ${periodLabel(slip.periodStart)})`,
          dedupeKey: `payslip:${slip.id}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(payslipSteps).values({
              payslipId: slip.id, periodStart: slip.periodStart, action: 'REOPEN_REQUEST', reason,
              summary: { requestId, number: slip.number, name: person.name }, actorAccountId: actor.accountId,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const step = await requestStep(tx, requestId);
      if (!step?.payslipId) return fail(404, 'Permintaan buka kembali tidak ditemukan.');
      const loaded = await loadSlip(step.payslipId);
      if (!loaded) return fail(404, 'Slip tidak ditemukan.');
      // Slip penyetuju sendiri: hanya GM yang boleh (GAJ-95).
      const ownAccount = (await activeHrisAccounts([loaded.person.id])).get(loaded.person.id);
      if (ownAccount === actorAccountId && !loaded.person.isGmPosition) return fail(403, 'Slip Anda sendiri dibuka kembali Pemilik lain atau GM.');
      return reopenInTx(tx, actorAccountId, step.payslipId, step.reason ?? 'Permintaan HR', announce, { requestId });
    },
    async effectPreview(requestId) {
      const step = await requestStep(db, requestId);
      const loaded = step?.payslipId ? await loadSlip(step.payslipId) : null;
      if (!loaded) return 'Slip akan dibuka kembali.';
      const block = await reopenBlock(loaded.slip);
      if (block) return `Tidak bisa disetujui sekarang: ${block}`;
      return `Slip ${loaded.slip.number} ${loaded.person.name} (bersih ${rupiah(loaded.slip.net ?? 0)}) kembali menjadi Perkiraan: baris versi ${loaded.slip.version} diganti, mutasi dana dibalik, bonus kembali Disahkan, sisa potongan kembali seperti sebelum ditutup. Nomor slip tetap; ditutup lagi menjadi versi ${loaded.slip.version + 1}. ${loaded.person.name} diberi tahu.`;
    },
    async describe(requestId) {
      const step = await requestStep(db, requestId);
      const loaded = step?.payslipId ? await loadSlip(step.payslipId) : null;
      if (!step || !loaded) return [];
      return [
        { label: 'Karyawan', before: null, after: loaded.person.name },
        { label: 'Slip', before: null, after: `${loaded.slip.number} · versi ${loaded.slip.version}` },
        { label: 'Periode', before: null, after: periodLabel(loaded.slip.periodStart) },
        { label: 'Bersih', before: null, after: loaded.slip.net != null ? rupiah(loaded.slip.net) : '-' },
        { label: 'Alasan', before: null, after: step.reason },
      ];
    },
    async resubmitValues(requestId) {
      const step = await requestStep(db, requestId);
      return step ? { slipId: step.payslipId, reason: step.reason } : null;
    },
  };
}

// ---- Layar Buka Kembali Slip (GAJ-L31) dan riwayat versi ----

export async function reopenScreen(actor: Actor | null, slipId: number) {
  const direct = Boolean(actor?.fullAccess) && hasAction(actor, 'payslip.reopen');
  if (!actor || !(direct || hasAction(actor, 'payslip.request_reopen'))) return null;
  const loaded = await loadSlip(slipId);
  if (!loaded || !canSeeSlip(actor, loaded.person) || loaded.slip.status !== 'CLOSED') return null;
  const { slip, person } = loaded;
  const block = (await reopenBlock(slip)) ?? (direct ? await ownSlipProblem(actor, person) : null);
  const [bonusCount] = await db.select({ n: sql<number>`count(*)::int` }).from(bonusEntries).where(eq(bonusEntries.payslipId, slip.id));
  const funds = await db.select({ fund: fundEntries.fund, amount: fundEntries.amount }).from(fundEntries).where(eq(fundEntries.payslipId, slip.id));
  const reversal = reversalMovements(funds.map((f) => ({ fund: f.fund as 'DISCIPLINE' | 'ABSENCE', amount: f.amount })), slip.number ?? '');
  const receivables = await db.select().from(otherReceivables).where(and(eq(otherReceivables.payslipId, slip.id), eq(otherReceivables.status, 'OPEN')));
  return {
    slip: { id: slip.id, number: slip.number, version: slip.version, name: person.name, period: periodLabel(slip.periodStart), net: slip.net ?? 0, lastSlip: slip.lastSlip },
    direct, block,
    effects: {
      bonuses: Number(bonusCount?.n ?? 0),
      funds: reversal.map((m) => ({ fund: m.fund === 'DISCIPLINE' ? 'Dana Disiplin' : 'Dana Tidak Hadir', amount: m.amount })),
      receivables: receivables.reduce((s, r) => s + r.amount, 0),
    },
  };
}

/** Riwayat versi satu slip (tutup, buka kembali, permintaan, cetak). */
export async function slipVersions(slipId: number) {
  const [steps, names] = await Promise.all([
    db.select().from(payslipSteps).where(eq(payslipSteps.payslipId, slipId)).orderBy(desc(payslipSteps.createdAt)),
    accountNames(),
  ]);
  const lines = await db.select({ version: payslipLines.version, status: payslipLines.status, n: sql<number>`count(*)::int` }).from(payslipLines)
    .where(eq(payslipLines.payslipId, slipId)).groupBy(payslipLines.version, payslipLines.status).orderBy(asc(payslipLines.version));
  return {
    steps: steps.map((s) => {
      const summary = (s.summary ?? {}) as Record<string, unknown>;
      return {
        id: s.id, action: s.action, at: wibTime(s.createdAt), by: names.get(s.actorAccountId) ?? '-', reason: s.reason,
        version: typeof summary.version === 'number' ? summary.version : null, net: typeof summary.net === 'number' ? summary.net : null,
        requestId: typeof summary.requestId === 'number' ? summary.requestId : null,
      };
    }),
    replacedVersions: [...new Set(lines.filter((l) => l.status === 'REPLACED').map((l) => l.version))],
  };
}

/** Permintaan buka kembali yang masih terbuka untuk slip ini (supaya HR tidak mengirim dua kali). */
export async function openReopenRequest(slipId: number): Promise<number | null> {
  const [row] = await db.select({ id: requests.id }).from(requests)
    .innerJoin(payslipSteps, and(eq(payslipSteps.action, 'REOPEN_REQUEST'), sql`(${payslipSteps.summary} ->> 'requestId')::int = ${requests.id}`))
    .where(and(eq(payslipSteps.payslipId, slipId), eq(requests.typeKey, 'payslip_reopen'), inArray(requests.status, ['PENDING', 'REVIEWED'])))
    .orderBy(desc(requests.id)).limit(1);
  return row?.id ?? null;
}

// ---- Piutang Lain (GAJ-82, 96) ----

export async function receivablesScreen(actor: Actor | null, filter: { status: ReceivableStatus | null }) {
  const manage = Boolean(actor?.fullAccess) && hasAction(actor, 'receivable.manage');
  if (!actor || !(manage || hasAction(actor, 'receivable.view'))) return null;
  const people = await loadPayrollPeople();
  const all = await db.select({ r: otherReceivables, number: payslips.number, periodStart: payslips.periodStart }).from(otherReceivables)
    .innerJoin(payslips, eq(payslips.id, otherReceivables.payslipId)).orderBy(desc(otherReceivables.createdAt));
  // Cicilan dari bayar di luar slip (L4f-2, Y5).
  const settled = await settledByReceivable(all.map(({ r }) => r.id));
  const everyone = await allPeopleNames();
  const names = await accountNames();
  const rows = all.filter(({ r }) => filter.status == null || r.status === filter.status)
    .filter(({ r }) => {
      const p = people.find((x) => x.id === r.employeeId);
      return !p?.ownerOnly || actor.fullAccess;
    })
    .map(({ r, number, periodStart }) => ({
      id: r.id, employeeId: r.employeeId, name: everyone.get(r.employeeId) ?? `#${r.employeeId}`, slipId: r.payslipId, number, period: periodLabel(periodStart),
      group: GROUP_LABELS[r.deductionGroup as DeductionGroup], amount: r.amount, settled: settled.get(r.id) ?? 0, remaining: r.amount - (settled.get(r.id) ?? 0),
      status: r.status as ReceivableStatus,
      statusLabel: RECEIVABLE_STATUS_LABELS[r.status as ReceivableStatus], reason: r.reason,
      decided: r.decidedAt ? `${names.get(r.decidedByAccountId ?? 0) ?? '-'} · ${wibTime(r.decidedAt)}` : null,
      canWriteOff: manage && r.status === 'OPEN' && r.employeeId !== actor.personId,
    }));
  const open = all.filter(({ r }) => r.status === 'OPEN');
  return { rows, filter, manage, totalOpen: open.reduce((s, { r }) => s + r.amount - (settled.get(r.id) ?? 0), 0), countOpen: open.length };
}

/** Nama semua orang (termasuk yang sudah berhenti) untuk daftar Piutang Lain. */
async function allPeopleNames(): Promise<Map<number, string>> {
  return new Map((await listPeopleForModules()).map((p) => [p.id, p.name]));
}

/** Hapuskan Piutang Lain (Pemilik/GM, alasan ≥ 15 huruf). */
export async function writeOffReceivable(actor: Actor | null, id: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<object>> {
  if (!actor?.fullAccess || !hasAction(actor, 'receivable.manage')) return fail(403, 'Hanya Pemilik atau GM yang menghapuskan Piutang Lain.');
  const reason = String(reasonInput ?? '').trim();
  const problem = reasonProblem(reason);
  if (problem) return fail(400, problem);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(otherReceivables).where(eq(otherReceivables.id, id)).for('update');
    if (!row || row.status !== 'OPEN') return fail(409, 'Piutang ini sudah tidak terbuka.');
    if (row.employeeId === actor.personId) return fail(403, 'Piutang atas diri Anda sendiri dihapuskan pemilik lain.');
    await tx.update(otherReceivables).set({ status: 'WRITTEN_OFF', reason, decidedAt: new Date(), decidedByAccountId: actor.accountId }).where(eq(otherReceivables.id, id));
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'other_receivable', entityId: id, action: 'receivable.write_off', before: { status: 'OPEN' }, after: { status: 'WRITTEN_OFF', amount: row.amount }, reason });
    const name = (await allPeopleNames()).get(row.employeeId) ?? `#${row.employeeId}`;
    await announce(tx, actor.accountId, { what: `menghapuskan Piutang Lain ${name} ${rupiah(row.amount)}: ${reason}`, link: '/gaji/piutang', entity: 'other_receivable', entityId: id });
    return { ok: true as const, data: {} };
  });
}

/** Piutang Lain dan Tidak tertagih milik satu slip (ditampilkan di layar slip terakhir). */
export async function receivablesOfSlip(slipId: number) {
  return db.select({ id: otherReceivables.id, group: otherReceivables.deductionGroup, amount: otherReceivables.amount, status: otherReceivables.status })
    .from(otherReceivables).where(eq(otherReceivables.payslipId, slipId)).orderBy(asc(otherReceivables.id));
}

/** Tambahan layar Slip L4e-2: tombol Buka kembali / Minta buka kembali / Tutup lebih cepat, riwayat versi, sisa slip terakhir. */
export async function slipExtras(actor: Actor | null, slipId: number, now: Date = new Date()) {
  const loaded = await loadSlip(slipId);
  if (!actor || !loaded || !canSeeSlip(actor, loaded.person)) return null;
  const { slip, person } = loaded;
  const closed = slip.status === 'CLOSED';
  const direct = Boolean(actor.fullAccess) && hasAction(actor, 'payslip.reopen');
  const requester = !actor.fullAccess && hasAction(actor, 'payslip.request_reopen');
  const block = closed ? (await reopenBlock(slip)) ?? (direct ? await ownSlipProblem(actor, person) : null) : null;
  const pendingRequestId = closed && requester ? await openReopenRequest(slip.id) : null;
  const last = lastSlipOf(person, slip.periodStart);
  const earlyAllowed = Boolean(actor.fullAccess) && hasAction(actor, 'payslip.early_close');
  const earlyBlock = !closed && last && earlyAllowed ? earlyCloseProblem(actor, person, slip.periodStart, now) : null;
  const receivables = closed && slip.lastSlip ? await receivablesOfSlip(slip.id) : [];
  return {
    can: {
      reopen: closed && direct && !block,
      requestReopen: closed && requester && !block && pendingRequestId == null,
      earlyClose: !closed && last && earlyAllowed && !earlyBlock,
    },
    reopenBlock: closed && (direct || requester) ? block : null,
    pendingRequestId,
    lastSlip: last || slip.lastSlip,
    withoutNotice: Boolean(person.lastStatus?.withoutNotice) && (last || slip.lastSlip),
    lastWorkingDay: last && person.lastStatus ? person.lastStatus.effectiveOn : null,
    earlyBlock,
    receivables: receivables.map((r) => ({ ...r, groupLabel: GROUP_LABELS[r.group as DeductionGroup], statusLabel: RECEIVABLE_STATUS_LABELS[r.status as ReceivableStatus] })),
    versions: await slipVersions(slip.id),
  };
}
