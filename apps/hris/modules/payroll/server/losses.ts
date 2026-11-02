import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { inventoryLosses } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { getOrgLookup, hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { checkReason, loadRows, resolveSetting, setSetting, settingOn, upcomingRows } from '@/modules/settings';
import { splitLoss, type LossSplit } from '../rules/losses';
import { addPeriods, longDate, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { isPeriodLocked, periodChoices } from './attendance-pay';
import { accountNames } from './data';
import { lossHolders, periodOf } from './deduction-data';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export const LOSS_STATUS_LABELS = { PENDING: 'Menunggu pengesahan', ACTIVE: 'Berlaku', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan' } as const;
export type LossStatus = keyof typeof LOSS_STATUS_LABELS;

/** Persen kantor cabang itu pada tanggal itu; null bila cabangnya belum punya persen sendiri (spec L4c §3.1). */
export async function officePercentOn(branchId: number, date: IsoDate): Promise<number | null> {
  const rows = (await loadRows(db, ['payroll.loss_office_percent'])).filter((r) => r.targetKind === 'BRANCH' && r.targetId === branchId);
  const row = resolveSetting(rows, date, { branchId });
  return row ? Number(row.value) : null;
}

/** Pembagian satu kehilangan (dihitung saat dibaca, GAJ-77). Null bila persen kantor belum diisi. */
export async function lossSplitOf(branchId: number, foundOn: IsoDate, amount: number): Promise<(LossSplit & { officePercent: number; periodDays: number }) | null> {
  const period = periodOf(foundOn);
  const officePercent = await officePercentOn(branchId, period.start);
  if (officePercent == null) return null;
  const holders = await lossHolders(branchId, period.start);
  return { ...splitLoss({ amount, officePercent, periodDays: period.days, holders }), officePercent, periodDays: period.days };
}

type LossInput = { branchId: unknown; foundOn: unknown; amount: unknown; description: unknown; attachmentId: unknown };
type CheckedLoss = { branchId: number; branchName: string; foundOn: IsoDate; amount: number; description: string; attachmentId: string };

async function checkLoss(executor: Tx, actor: Actor, input: LossInput, today: IsoDate): Promise<CheckedLoss | Fail> {
  const org = await getOrgLookup();
  const branch = org.branches.find((b) => b.id === Number(input.branchId) && b.active);
  if (!branch) return fail(400, 'Pilih cabang.');
  const foundOn = String(input.foundOn ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(foundOn)) return fail(400, 'Isi tanggal ditemukan.');
  if (foundOn > today) return fail(400, 'Tanggal ditemukan tidak boleh di masa depan.');
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000) return fail(400, 'Nilai harus rupiah bulat lebih dari 0.');
  const description = String(input.description ?? '').trim();
  if (description.length < 10) return fail(400, 'Keterangan paling sedikit 10 huruf (misalnya "hasil opname November: makanan kucing").');
  const attachmentId = String(input.attachmentId ?? '');
  if (!(await filesUploadedBy(executor, actor.accountId, [attachmentId])).length) return fail(400, 'Foto hasil opname wajib dilampirkan.');
  if (await isPeriodLocked(periodStartOf(foundOn))) return fail(409, 'Slip periode itu sudah ditutup. Kehilangannya masuk slip berikutnya (menyusul bersama Tutup Slip).');
  if ((await officePercentOn(branch.id, periodStartOf(foundOn))) == null) {
    return fail(409, `${branch.name} belum punya persen kantor untuk periode itu. Isi dulu di Pengaturan › Tanggungan Kehilangan.`);
  }
  return { branchId: branch.id, branchName: branch.name, foundOn, amount, description, attachmentId };
}

async function tellHolders(tx: Tx, row: { id: number; branchId: number; foundOn: IsoDate; amount: number }, branchName: string, actorAccountId: number) {
  const split = await lossSplitOf(row.branchId, row.foundOn, row.amount);
  if (!split) return;
  const accounts = await activeHrisAccounts(split.shares.map((s) => s.employeeId));
  for (const share of split.shares) {
    const account = accounts.get(share.employeeId);
    if (!account || share.amount <= 0) continue;
    await notify(tx, [account], {
      kind: 'inventory_loss.active',
      title: `Ada kehilangan barang ${rupiah(row.amount)} di ${branchName} (opname ${longDate(row.foundOn)}).`,
      body: `Bagian Anda ${rupiah(share.amount)}, dipotong di slip periode ${longDate(periodStartOf(row.foundOn))}.`,
      link: '/panduan/aturan-potongan', entity: 'inventory_loss', entityId: row.id,
    }, actorAccountId);
  }
}

/** GAJ-L13 langsung oleh Pemilik/GM: Berlaku saat disimpan. HR lewat usulan (`inventoryLossHandler`). */
export async function recordLossDirect(actor: Actor | null, input: LossInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang mencatat langsung; HR mencatat sebagai usulan.');
  return db.transaction(async (tx) => {
    const checked = await checkLoss(tx, actor, input, todayWib(now));
    if ('ok' in checked) return checked;
    const [row] = await tx.insert(inventoryLosses).values({
      branchId: checked.branchId, foundOn: checked.foundOn, amount: checked.amount, description: checked.description,
      attachmentFileId: checked.attachmentId, status: 'ACTIVE', recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
      approvedByAccountId: actor.accountId, approvedAt: now,
    }).returning({ id: inventoryLosses.id });
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'inventory_loss', entityId: row.id, action: 'inventory_loss.create', before: null, after: { ...checked, status: 'ACTIVE' } });
    await tellHolders(tx, { id: row.id, ...checked }, checked.branchName, actor.accountId);
    await announce(tx, actor.accountId, { what: `mencatat kehilangan barang ${rupiah(checked.amount)} di ${checked.branchName} (${longDate(checked.foundOn)})`, link: `/potongan/kehilangan-barang/${row.id}`, entity: 'inventory_loss', entityId: row.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

async function loadLoss(executor: typeof db | Tx, by: { id?: number; requestId?: number }) {
  const [row] = await executor.select().from(inventoryLosses)
    .where(by.id != null ? eq(inventoryLosses.id, by.id) : eq(inventoryLosses.requestId, by.requestId ?? -1));
  return row ?? null;
}

const branchNameOf = async (branchId: number) => (await getOrgLookup()).branches.find((b) => b.id === branchId)?.name ?? `Cabang #${branchId}`;

async function splitText(branchId: number, foundOn: IsoDate, amount: number) {
  const split = await lossSplitOf(branchId, foundOn, amount);
  if (!split) return 'Persen kantor cabang ini belum diisi.';
  const people = split.shares.map((s) => `${s.name} ${rupiah(s.amount)}`).join(', ');
  return `${people || 'Tidak ada yang ikut menanggung'}; kantor ${rupiah(split.office.total)}.`;
}

/** Usulan kehilangan barang oleh HR (Mesin Pengajuan); disahkan Pemilik/GM. */
export function inventoryLossHandler(announce: ChangeAnnounce): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      if (actor.fullAccess) return fail(400, 'Pemilik dan GM mencatat kehilangan langsung.');
      const checked = await checkLoss(tx, actor, input as LossInput, todayWib());
      if ('ok' in checked) return checked;
      const split = await lossSplitOf(checked.branchId, checked.foundOn, checked.amount);
      if (!split?.shares.length) return fail(409, 'Tidak ada yang ikut menanggung di cabang ini pada periode itu. Hanya Pemilik atau GM yang bisa mencatatnya (seluruhnya ditanggung kantor).');
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Kehilangan barang ${rupiah(checked.amount)} di ${checked.branchName} (${longDate(checked.foundOn)})`,
          dedupeKey: null,
          requiredAttachment: 'Foto hasil opname',
          save: async (saveTx, requestId) => {
            await saveTx.insert(inventoryLosses).values({
              branchId: checked.branchId, foundOn: checked.foundOn, amount: checked.amount, description: checked.description,
              attachmentFileId: checked.attachmentId, status: 'PENDING', requestId, recordedByAccountId: actor.accountId, recordedByEmployeeId: actor.personId,
            });
          },
        },
      };
    },
    async apply(tx, actorAccountId, requestId) {
      const row = await loadLoss(tx, { requestId });
      if (!row || row.status !== 'PENDING') return fail(404, 'Usulan kehilangan barang tidak ditemukan.');
      if (await isPeriodLocked(periodStartOf(row.foundOn))) return fail(409, 'Slip periode itu sudah ditutup.');
      if ((await officePercentOn(row.branchId, periodStartOf(row.foundOn))) == null) return fail(409, 'Cabang ini belum punya persen kantor untuk periode itu. Isi dulu di Tanggungan Kehilangan.');
      await tx.update(inventoryLosses).set({ status: 'ACTIVE', approvedByAccountId: actorAccountId, approvedAt: new Date() }).where(eq(inventoryLosses.id, row.id));
      const branchName = await branchNameOf(row.branchId);
      await tellHolders(tx, row, branchName, actorAccountId);
      await announce(tx, actorAccountId, { what: `mengesahkan kehilangan barang ${rupiah(row.amount)} di ${branchName}`, link: `/potongan/kehilangan-barang/${row.id}`, entity: 'inventory_loss', entityId: row.id });
      return { ok: true as const, effect: `Kehilangan barang berlaku. Yang menanggung diberi tahu bagiannya.` };
    },
    async close(tx, _actorAccountId, requestId) {
      await tx.update(inventoryLosses).set({ status: 'REJECTED' }).where(and(eq(inventoryLosses.requestId, requestId), eq(inventoryLosses.status, 'PENDING')));
    },
    async effectPreview(requestId) {
      const row = await loadLoss(db, { requestId });
      return row ? `Berlaku dan dibagi: ${await splitText(row.branchId, row.foundOn, row.amount)} Yang menanggung diberi tahu bagiannya.` : 'Usulan ini akan disahkan.';
    },
    async describe(requestId) {
      const row = await loadLoss(db, { requestId });
      if (!row) return [];
      return [
        { label: 'Cabang', before: null, after: await branchNameOf(row.branchId) },
        { label: 'Tanggal ditemukan', before: null, after: longDate(row.foundOn) },
        { label: 'Nilai', before: null, after: rupiah(row.amount) },
        { label: 'Keterangan', before: null, after: row.description },
        { label: 'Pembagian (hari ini)', before: null, after: await splitText(row.branchId, row.foundOn, row.amount) },
      ];
    },
    async resubmitValues(requestId) {
      const row = await loadLoss(db, { requestId });
      return row ? { branchId: row.branchId, foundOn: row.foundOn, amount: row.amount, description: row.description } : null;
    },
  };
}

/** Batalkan kehilangan (Pemilik/GM, alasan) hanya sebelum masuk slip yang ditutup (GAJ-L12). */
export async function cancelLoss(actor: Actor | null, id: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<object>> {
  if (!actor?.fullAccess || !hasAction(actor, 'deduction.approve')) return fail(403, 'Hanya Pemilik atau GM yang bisa membatalkan.');
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  const row = await loadLoss(db, { id });
  if (!row || row.status !== 'ACTIVE') return fail(404, 'Kehilangan yang berlaku tidak ditemukan.');
  if (await isPeriodLocked(periodStartOf(row.foundOn))) return fail(409, 'Sudah masuk slip yang ditutup. Koreksinya lewat slip berikutnya.');
  const branchName = await branchNameOf(row.branchId);
  return db.transaction(async (tx) => {
    const updated = await tx.update(inventoryLosses).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.reason })
      .where(and(eq(inventoryLosses.id, id), eq(inventoryLosses.status, 'ACTIVE'))).returning({ id: inventoryLosses.id });
    if (!updated.length) return fail(409, 'Kehilangan ini baru saja diubah orang lain.');
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'inventory_loss', entityId: id, action: 'inventory_loss.cancel', before: { status: 'ACTIVE' }, after: { status: 'CANCELLED' }, reason: reason.reason });
    const split = await lossSplitOf(row.branchId, row.foundOn, row.amount);
    const accounts = await activeHrisAccounts(split?.shares.map((s) => s.employeeId) ?? []);
    await notify(tx, [...accounts.values()], { kind: 'inventory_loss.cancelled', title: `Kehilangan barang ${branchName} ${longDate(row.foundOn)} dibatalkan; tidak dipotong.`, entity: 'inventory_loss', entityId: id }, actor.accountId);
    await announce(tx, actor.accountId, { what: `membatalkan kehilangan barang ${rupiah(row.amount)} di ${branchName}`, link: `/potongan/kehilangan-barang/${id}`, entity: 'inventory_loss', entityId: id });
    return { ok: true as const, data: {} };
  });
}

// ---- Layar ----

const canView = (actor: Actor | null) => hasAction(actor, 'inventory_loss.view') || hasAction(actor, 'deduction.approve');

export async function lossesScreen(actor: Actor | null, input: { period: string | null; branchId: number | null; status: LossStatus | null }, now: Date = new Date()) {
  if (!canView(actor)) return null;
  const today = todayWib(now);
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === input.period) ?? periods[0];
  const org = await getOrgLookup();
  const rows = await db.select().from(inventoryLosses)
    .where(and(gte(inventoryLosses.foundOn, period.start), lte(inventoryLosses.foundOn, period.end)))
    .orderBy(desc(inventoryLosses.foundOn), desc(inventoryLosses.id));
  const names = await accountNames();
  const branches = org.branches.filter((b) => b.active);
  const missingOffice: string[] = [];
  for (const branch of branches) if ((await officePercentOn(branch.id, period.start)) == null) missingOffice.push(branch.name);
  return {
    period, periods, filter: input,
    branches: branches.map(({ id, name }) => ({ id, name })),
    missingOffice,
    canRecord: hasAction(actor, 'inventory_loss.record') || hasAction(actor, 'deduction.approve'),
    rows: rows
      .filter((r) => (input.branchId == null || r.branchId === input.branchId) && (input.status == null || r.status === input.status))
      .map((r) => ({
        id: r.id, branchName: org.branches.find((b) => b.id === r.branchId)?.name ?? '-', foundOn: r.foundOn, amount: r.amount, description: r.description,
        status: r.status as LossStatus, recordedBy: names.get(r.recordedByAccountId) ?? '-', approvedBy: r.approvedByAccountId ? names.get(r.approvedByAccountId) ?? '-' : null,
        requestId: r.requestId,
      })),
  };
}

export async function lossDetailScreen(actor: Actor | null, id: number) {
  if (!canView(actor)) return null;
  const row = await loadLoss(db, { id });
  if (!row) return null;
  const names = await accountNames();
  const split = await lossSplitOf(row.branchId, row.foundOn, row.amount);
  return {
    loss: {
      id: row.id, branchName: await branchNameOf(row.branchId), foundOn: row.foundOn, amount: row.amount, description: row.description,
      status: row.status as LossStatus, requestId: row.requestId, recordedBy: names.get(row.recordedByAccountId) ?? '-',
      approvedBy: row.approvedByAccountId ? names.get(row.approvedByAccountId) ?? '-' : null, approvedAt: row.approvedAt?.toISOString() ?? null,
      cancelReason: row.cancelReason, period: periodOf(row.foundOn),
    },
    split,
    canCancel: row.status === 'ACTIVE' && !!actor?.fullAccess && hasAction(actor, 'deduction.approve'),
  };
}

/** Pratinjau pembagian di langkah 4 Catat Kehilangan (fungsi yang sama dengan hitungan). */
export async function previewLoss(actor: Actor | null, input: { branchId: unknown; foundOn: unknown; amount: unknown }, now: Date = new Date()) {
  if (!hasAction(actor, 'inventory_loss.record') && !hasAction(actor, 'deduction.approve')) return fail(403, 'Anda tidak berhak mencatat kehilangan barang.');
  const foundOn = String(input.foundOn ?? '');
  const amount = Number(input.amount);
  const branchId = Number(input.branchId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(foundOn) || foundOn > todayWib(now) || !Number.isInteger(amount) || amount <= 0) return fail(400, 'Lengkapi cabang, tanggal, dan nilai.');
  const split = await lossSplitOf(branchId, foundOn, amount);
  if (!split) return fail(409, 'Cabang ini belum punya persen kantor untuk periode itu. Isi dulu di Pengaturan › Tanggungan Kehilangan.');
  return { ok: true as const, data: { split } };
}

/** Lampiran kehilangan hanya untuk yang boleh melihat daftar Kehilangan Barang. */
export async function openLossAttachment(actor: Actor | null, id: number): Promise<string | null> {
  if (!canView(actor)) return null;
  const row = await loadLoss(db, { id });
  return row?.attachmentFileId ?? null;
}

// ---- Tanggungan Kehilangan Barang (GAJ-L14) ----

const SAMPLE_LOSS = 1_000_000;

export async function lossSettingsScreen(actor: Actor | null, now: Date = new Date()) {
  if (!canView(actor) && !hasAction(actor, 'settings.manage')) return null;
  const today = todayWib(now);
  const period = periodOf(today);
  const next = addPeriods(period.start, 1);
  const org = await getOrgLookup();
  const rows = (await loadRows(db, ['payroll.loss_office_percent'])).filter((r) => r.targetKind === 'BRANCH');
  const branches = [];
  for (const branch of org.branches.filter((b) => b.active)) {
    const own = rows.filter((r) => r.targetId === branch.id);
    const current = resolveSetting(own, today, { branchId: branch.id });
    const holders = await lossHolders(branch.id, period.start);
    const example = current ? splitLoss({ amount: SAMPLE_LOSS, officePercent: Number(current.value), periodDays: period.days, holders }) : null;
    branches.push({
      id: branch.id, name: branch.name, current: current ? Number(current.value) : null,
      latestId: own.reduce<number | null>((max, r) => (max === null || r.id > max ? r.id : max), null),
      firstFill: !own.some((r) => r.status === 'ACTIVE'),
      scheduled: upcomingRows(own, today, 'BRANCH', branch.id).map((r) => ({ id: r.id, value: Number(r.value), effectiveFrom: r.effectiveFrom })),
      example: example ? { shares: example.shares.map((s) => ({ name: s.name, weight: s.weight, days: s.days, amount: s.amount })), office: example.office } : null,
    });
  }
  const positions = [];
  for (const position of org.positions.filter((p) => p.active)) {
    const [sharing, weight] = await Promise.all([
      settingOn<string>('position.loss_sharing', today, { positionId: position.id }),
      settingOn<number>('position.loss_weight', today, { positionId: position.id }),
    ]);
    positions.push({ id: position.id, name: position.name, sharing: !position.fullAccess && sharing === 'YES', weight: Number(weight), owner: position.fullAccess });
  }
  return {
    today, period, nextStart: next, firstFillStart: period.start, sample: SAMPLE_LOSS, branches, positions,
    canEdit: hasAction(actor, 'settings.manage'),
  };
}

export async function saveOfficePercent(
  actor: Actor | null, input: { branchId: number; value: unknown; effectiveFrom: unknown; reason: unknown; expectedLatestId: number | null; firstFill: boolean }, announce: ChangeAnnounce,
) {
  return setSetting(actor, {
    key: 'payroll.loss_office_percent', targetKind: 'BRANCH', targetId: input.branchId, value: Number(input.value),
    effectiveFrom: String(input.effectiveFrom ?? ''), reason: String(input.reason ?? ''), expectedLatestId: input.expectedLatestId, firstFill: input.firstFill,
  }, announce);
}
