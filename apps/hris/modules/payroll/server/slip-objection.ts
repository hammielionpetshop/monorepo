import { and, asc, desc, eq, gt, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { attendanceCorrections } from '@petshop/hris-db/schema/attendance';
import {
  bonusEntries, offSlipClaims, otherDeductions, otherReceivables, payWaivers, paymentSources, payslipLines, payslipObjections, payslipPayments, payslipSteps,
  payslips, salaryChanges,
} from '@petshop/hris-db/schema/payroll';
import { requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import {
  can, listEmployeesWithAnyAction, loadActor, recordAudit, type Actor, type ActionName, type ChangeAnnounce, type ServiceResult, type Tx,
} from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { notify } from '@/modules/notifications';
import type { ApproveChoices, RequestHandler } from '@/modules/requests';
import { PAY_METHOD_LABELS, type PayMethod } from '../rules/payment';
import { longDate, rupiah } from '../rules/salary';
import {
  FIX_ATTENTION_DAYS, FIX_KIND_LABELS, FIX_PATH_LABELS, FIX_STATUS_LABELS, OBJECTION_KIND_LABELS, OBJECTION_REASON_MIN, fixPathsFor, notReceivedWindow,
  waitingFixDays, wrongWindow, type FixKind, type FixPath, type FixStatus, type ObjectionKind, type Window,
} from '../rules/slip-objection';
import { accountNames, type Executor, type PayrollPerson } from './data';
import { reopenBlock } from './payslip-reopen';
import { loadSlip, periodLabel, slipContent, wibTime, type SlipRow } from './payslip';

// L4g-2 Keberatan slip (spec L4g §3.5–3.6; GAJ-110, 111). Isi khas dua jenis pengajuan (menurut penyetujunya),
// keputusan + jalan pembetulan, Tautkan pembetulan, pengingat harian, dan kartu Beranda.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

export type ObjectionTypeKey = 'payslip_objection' | 'payslip_objection_owner';
type ObjectionRow = typeof payslipObjections.$inferSelect;
type ObjectionLine = { key: string; label: string; amount: number; section: 'INCOME' | 'DEDUCTION' | 'NOTE' };

export const OBJECTION_TYPE_KEYS: readonly ObjectionTypeKey[] = ['payslip_objection', 'payslip_objection_owner'];
const DECIDE_ACTION: Record<ObjectionTypeKey, ActionName> = { payslip_objection: 'payslip_objection.decide', payslip_objection_owner: 'payslip_objection.decide_owner' };

/** "Uang belum diterima" dan slip jabatan bertanda diputus Pemilik/GM saja; selebihnya HR, Pemilik, GM (spec L4g §5). */
export function objectionTypeFor(kind: ObjectionKind, person: Pick<PayrollPerson, 'ownerOnly'>): ObjectionTypeKey {
  return kind === 'NOT_RECEIVED' || person.ownerOnly ? 'payslip_objection_owner' : 'payslip_objection';
}

const isKind = (value: unknown): value is ObjectionKind => value === 'WRONG' || value === 'NOT_RECEIVED';

async function activePaymentOf(slipId: number, executor: Executor = db) {
  const [p] = await executor.select().from(payslipPayments).where(and(eq(payslipPayments.payslipId, slipId), eq(payslipPayments.status, 'ACTIVE')));
  return p ?? null;
}

/** Masa keberatan satu macam untuk slip ini sekarang. */
async function windowOf(kind: ObjectionKind, slip: SlipRow, now: Date, executor: Executor = db): Promise<Window> {
  if (kind === 'WRONG') return wrongWindow({ periodStart: slip.periodStart, status: slip.status as 'ESTIMATE' | 'CLOSED', objectionUntil: slip.objectionUntil }, now);
  const payment = slip.status === 'CLOSED' ? await activePaymentOf(slip.id, executor) : null;
  return notReceivedWindow(payment ? { kind: payment.kind as 'MONEY' | 'NO_MONEY', createdAt: payment.createdAt } : null, now);
}

async function pendingOf(slipId: number, kind: ObjectionKind, executor: Executor = db) {
  const [row] = await executor.select().from(payslipObjections)
    .where(and(eq(payslipObjections.payslipId, slipId), eq(payslipObjections.kind, kind), eq(payslipObjections.state, 'PENDING')));
  return row ?? null;
}

async function slipLinesOf(slip: SlipRow, person: PayrollPerson, now: Date): Promise<ObjectionLine[]> {
  const { view } = await slipContent(slip, person, now);
  return [...view.income, ...view.deductions.flatMap((g) => g.lines)].map((l) => ({ key: l.sourceKey, label: l.label, amount: l.amount, section: l.section }));
}

async function objectionByRequest(requestId: number, executor: Executor = db): Promise<ObjectionRow | null> {
  const [row] = await executor.select().from(payslipObjections).where(eq(payslipObjections.requestId, requestId));
  return row ?? null;
}

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const untilText = (until: Date | null) => (until ? `${timeFormat.format(until)}` : 'sampai slip ditutup');

// ---- Isian (GAJ-L41) ----

/** Layar Ajukan Keberatan Slip (3 langkah). Hanya slip sendiri; null = tidak ditemukan. */
export async function slipObjectionFormScreen(actor: Actor | null, slipId: number, kindInput: unknown, resubmitFrom: number | null, now: Date = new Date()) {
  if (!actor || !isKind(kindInput)) return null;
  const loaded = await loadSlip(slipId);
  if (!loaded || loaded.slip.employeeId !== actor.personId) return null;
  const { slip, person } = loaded;
  const kind = kindInput;
  const window = await windowOf(kind, slip, now);
  const pending = await pendingOf(slip.id, kind);
  const payment = kind === 'NOT_RECEIVED' ? await activePaymentOf(slip.id) : null;
  let prefill: { lines: string[]; reason: string } | null = null;
  if (resubmitFrom) {
    const [old] = await db.select({ o: payslipObjections, r: requests }).from(payslipObjections).innerJoin(requests, eq(requests.id, payslipObjections.requestId))
      .where(and(eq(payslipObjections.requestId, resubmitFrom), eq(payslipObjections.payslipId, slip.id), eq(requests.submittedByAccountId, actor.accountId), eq(requests.status, 'REJECTED')));
    if (old) prefill = { lines: (old.o.lines as ObjectionLine[]).map((l) => l.key), reason: old.o.reason };
  }
  const typeKey = objectionTypeFor(kind, person);
  return {
    slip: { id: slip.id, number: slip.number, period: periodLabel(slip.periodStart), estimate: slip.status === 'ESTIMATE', version: slip.version },
    kind, kindLabel: OBJECTION_KIND_LABELS[kind],
    lines: kind === 'WRONG' ? (await slipLinesOf(slip, person, now)).filter((l) => l.section !== 'NOTE') : [],
    payment: payment ? {
      text: `${rupiah(payment.amount)} ditandai Dibayar ${longDate(payment.moneyDate)} lewat ${payment.method ? PAY_METHOD_LABELS[payment.method as PayMethod].toLowerCase() : '—'}${payment.accountTail ? ` ke rekening ****${payment.accountTail}` : ''}`,
    } : null,
    open: window.open, closedReason: window.open ? null : window.reason, until: window.until?.toISOString() ?? null,
    pendingRequestId: pending?.requestId ?? null,
    decider: typeKey === 'payslip_objection' ? 'HR, Pemilik, atau GM' : 'Pemilik atau GM',
    typeKey, prefill, resubmittedFromId: prefill ? resubmitFrom : null,
  };
}

/** Isi khas jenis `payslip_objection` / `payslip_objection_owner` (spec L4g §3.5–3.6). */
export function payslipObjectionHandler(announce: ChangeAnnounce, typeKey: ObjectionTypeKey): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      const kind = input.kind;
      if (!isKind(kind)) return fail(400, 'Macam keberatan tidak dikenal.');
      const loaded = await loadSlip(Number(input.slipId));
      if (!loaded || loaded.slip.employeeId !== actor.personId) return fail(404, 'Slip tidak ditemukan.');
      const { slip, person } = loaded;
      if (objectionTypeFor(kind, person) !== typeKey) return fail(400, 'Jenis keberatan tidak cocok dengan slip ini.');
      const now = new Date();
      const window = await windowOf(kind, slip, now, tx);
      if (!window.open) return fail(409, window.reason);
      if (await pendingOf(slip.id, kind, tx)) return fail(409, 'Masih ada keberatan macam ini yang menunggu untuk slip ini. Tarik dulu bila ingin menambah keterangan.');
      const reason = String(input.reason ?? '').trim();
      if (reason.length < OBJECTION_REASON_MIN) return fail(400, `Alasan paling sedikit ${OBJECTION_REASON_MIN} huruf.`);
      let lines: ObjectionLine[] = [];
      let paymentId: number | null = null;
      if (kind === 'WRONG') {
        const wanted = Array.isArray(input.lines) ? [...new Set(input.lines.map(String))] : [];
        const all = await slipLinesOf(slip, person, now);
        lines = all.filter((l) => wanted.includes(l.key));
        if (lines.length !== wanted.length) return fail(400, 'Baris slip yang dipilih tidak ditemukan. Muat ulang halaman.');
      } else {
        const payment = await activePaymentOf(slip.id, tx);
        paymentId = payment!.id;
      }
      const what = kind === 'WRONG'
        ? (lines.length ? lines.map((l) => l.label).join(', ') : 'Lainnya')
        : 'uang belum diterima';
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Keberatan slip ${slip.number ?? '(Perkiraan)'} periode ${periodLabel(slip.periodStart)}: ${what}`.slice(0, 300),
          dedupeKey: `payslip:${slip.id}:${kind}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(payslipObjections).values({
              requestId, payslipId: slip.id, employeeId: slip.employeeId, slipVersion: slip.version, slipStatus: slip.status, kind, lines, paymentId, reason,
            });
          },
        },
      };
    },
    async approveChoices(requestId) {
      const paths = await availablePaths(requestId);
      return paths.length ? choicesOf(paths) : null;
    },
    async apply(tx, actorAccountId, requestId, fields) {
      const objection = await objectionByRequest(requestId, tx);
      if (!objection || objection.state !== 'PENDING') return fail(404, 'Keberatan tidak ditemukan.');
      const paths = await availablePaths(requestId, tx);
      const chosen = String(fields?.choice ?? '') || (paths.length === 1 ? paths[0] : '');
      if (!paths.includes(chosen as FixPath)) return fail(400, 'Pilih jalan pembetulan yang tersedia untuk keadaan slip ini.');
      const path = chosen as FixPath;
      // Jam DB: catatan pembetul dibandingkan dengan created_at buatan DB (Tautkan pembetulan).
      await tx.update(payslipObjections).set({ state: 'APPROVED', fixPath: path, fixStatus: 'WAITING_FIX', approvedAt: sql`now()`, approvedByAccountId: actorAccountId })
        .where(eq(payslipObjections.id, objection.id));
      await recordAudit(tx, {
        actorAccountId, entity: 'payslip_objection', entityId: objection.id, action: 'payslip_objection.approve',
        before: { state: 'PENDING' }, after: { state: 'APPROVED', fixPath: path, payslipId: objection.payslipId },
      });
      return { ok: true as const, effect: `Disetujui: akan dibetulkan (${FIX_PATH_LABELS[path].label.toLowerCase()}). Sesudah dibetulkan, penyetuju menautkan pembetulannya.` };
    },
    async close(tx, actorAccountId, requestId) {
      const objection = await objectionByRequest(requestId, tx);
      if (!objection || objection.state !== 'PENDING') return;
      // Ditolak penyetuju = REJECTED; dibatalkan pengajunya sendiri atau hangus = CLOSED.
      const own = (await activeHrisAccounts([objection.employeeId])).get(objection.employeeId) === actorAccountId;
      await tx.update(payslipObjections).set({ state: own ? 'CLOSED' : 'REJECTED' }).where(eq(payslipObjections.id, objection.id));
    },
    async effectPreview(requestId) {
      const objection = await objectionByRequest(requestId);
      if (!objection) return 'Keberatan ini akan disetujui.';
      const paths = await availablePaths(requestId);
      if (!paths.length) return 'Slip ini tidak ditemukan.';
      return 'Disetujui = "benar, akan dibetulkan", tanpa isian nominal. Pilih jalan pembetulannya; pengajuan bertanda "menunggu pembetulan" sampai Anda menautkan catatan pembetulnya. Tolak = alasan paling sedikit 15 huruf.';
    },
    async describe(requestId, reveal) {
      const objection = await objectionByRequest(requestId);
      if (!objection) return [];
      const loaded = await loadSlip(objection.payslipId);
      const lines = objection.lines as ObjectionLine[];
      const rows = [
        { label: 'Slip', before: null, after: loaded ? `${loaded.slip.number ?? 'Perkiraan'} · periode ${periodLabel(loaded.slip.periodStart)}` : `#${objection.payslipId}` },
        { label: 'Keadaan saat diajukan', before: null, after: objection.slipStatus === 'ESTIMATE' ? 'Perkiraan' : `Ditutup, versi ${objection.slipVersion}` },
        { label: 'Macam', before: null, after: OBJECTION_KIND_LABELS[objection.kind as ObjectionKind] },
      ];
      if (objection.kind === 'WRONG') {
        rows.push({ label: 'Baris dikeberati', before: null, after: lines.length ? lines.map((l) => `${l.label} ${reveal ? rupiah(l.amount) : ''}`.trim()).join('; ') : 'Lainnya' });
      } else if (objection.paymentId) {
        const [p] = await db.select({ p: payslipPayments, source: paymentSources.name }).from(payslipPayments)
          .leftJoin(paymentSources, eq(paymentSources.id, payslipPayments.sourceId)).where(eq(payslipPayments.id, objection.paymentId));
        if (p) {
          const names = await accountNames();
          rows.push({
            label: 'Pembayaran',
            before: null,
            after: `${rupiah(p.p.amount)} · tanggal uang ${longDate(p.p.moneyDate)} · ${p.source ?? '—'} · dibayar ${names.get(p.p.paidByAccountId) ?? '-'}${p.p.status === 'CANCELLED' ? ' (sudah dibatalkan)' : ''}`,
          });
        }
      }
      rows.push({ label: 'Alasan keberatan', before: null, after: objection.reason });
      if (objection.state === 'APPROVED' && objection.fixPath) {
        rows.push({ label: 'Jalan pembetulan', before: null, after: FIX_PATH_LABELS[objection.fixPath as FixPath].label });
        rows.push({ label: 'Pembetulan', before: null, after: fixText(objection) });
      }
      return rows;
    },
    async resubmitValues(requestId) {
      const objection = await objectionByRequest(requestId);
      return objection ? { slipId: objection.payslipId, kind: objection.kind, lines: (objection.lines as ObjectionLine[]).map((l) => l.key), reason: objection.reason } : null;
    },
  };
}

function choicesOf(paths: FixPath[]): ApproveChoices {
  return { label: 'Jalan pembetulan', options: paths.map((p) => ({ value: p, label: FIX_PATH_LABELS[p].label, hint: FIX_PATH_LABELS[p].hint })) };
}

/** Jalan pembetulan menurut keadaan slip sekarang (server menyaring pilihan penyetuju). */
async function availablePaths(requestId: number, executor: Executor = db): Promise<FixPath[]> {
  const objection = await objectionByRequest(requestId, executor);
  if (!objection) return [];
  const [slip] = await executor.select().from(payslips).where(eq(payslips.id, objection.payslipId));
  if (!slip) return [];
  const reopenable = slip.status === 'CLOSED' && (await reopenBlock(slip, executor)) == null;
  return fixPathsFor({ kind: objection.kind as ObjectionKind, status: slip.status as 'ESTIMATE' | 'CLOSED', reopenable });
}

function fixText(o: Pick<ObjectionRow, 'state' | 'fixStatus' | 'fixText'>): string {
  if (o.state !== 'APPROVED') return '—';
  return o.fixStatus === 'FIXED' ? `Sudah dibetulkan: ${o.fixText ?? '-'}` : 'Disetujui: akan dibetulkan (menunggu pembetulan)';
}

// ---- Kartu keberatan di Slip Saya (GAJ-L40, L4g-2) ----

const STATE_LABELS: Record<string, string> = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', CLOSED: 'Dibatalkan' };

/** Tombol keberatan + daftar keberatan slip ini untuk orangnya sendiri. */
export async function mySlipObjections(slip: SlipRow, now: Date = new Date()) {
  const rows = await db.select({ o: payslipObjections, r: requests }).from(payslipObjections).innerJoin(requests, eq(requests.id, payslipObjections.requestId))
    .where(eq(payslipObjections.payslipId, slip.id)).orderBy(desc(payslipObjections.createdAt));
  const options = await Promise.all((['WRONG', 'NOT_RECEIVED'] as const).map(async (kind) => {
    const window = await windowOf(kind, slip, now);
    const pending = rows.find((x) => x.o.kind === kind && x.o.state === 'PENDING');
    return {
      kind, label: OBJECTION_KIND_LABELS[kind], open: window.open && !pending, until: window.until ? untilText(window.until) : null,
      reason: window.open ? null : window.reason, pendingRequestId: pending?.o.requestId ?? null,
    };
  }));
  return {
    // "Uang belum saya terima" hanya tampil sesudah slip ditandai Dibayar dengan uang.
    options: options.filter((o) => o.kind === 'WRONG' || o.open || o.pendingRequestId || (o.until != null)),
    list: rows.map(({ o, r }) => ({
      requestId: o.requestId, kind: OBJECTION_KIND_LABELS[o.kind as ObjectionKind], state: STATE_LABELS[o.state] ?? o.state,
      at: wibTime(o.createdAt), decisionReason: o.state === 'REJECTED' ? r.decisionReason : null,
      fix: o.state === 'APPROVED' ? fixText(o) : null,
    })),
  };
}

// ---- Putuskan: isi khas di /persetujuan/[id] (GAJ-L42) dan Tautkan pembetulan ----

async function objectionWithSlip(requestId: number) {
  const objection = await objectionByRequest(requestId);
  if (!objection) return null;
  const loaded = await loadSlip(objection.payslipId);
  if (!loaded) return null;
  const [request] = await db.select().from(requests).where(eq(requests.id, requestId));
  return request ? { objection, request, ...loaded } : null;
}

/** Penyetuju jenis ini atas orang ini, bukan miliknya sendiri. */
function isDecider(actor: Actor | null, typeKey: string, person: PayrollPerson): actor is Actor {
  if (!actor || !(OBJECTION_TYPE_KEYS as readonly string[]).includes(typeKey)) return false;
  if (actor.personId === person.id) return false;
  if (person.ownerOnly && !actor.fullAccess) return false;
  return can(actor, DECIDE_ACTION[typeKey as ObjectionTypeKey], person.target);
}

/** Tujuan tombol per jalan pembetulan. */
function destinations(path: FixPath, slip: SlipRow, person: PayrollPerson, actor: Actor, objectionId: number): { label: string; href: string }[] {
  const source = [
    { label: 'Koreksi absen', href: '/kehadiran/koreksi' },
    { label: 'Potongan orang ini', href: `/gaji/${person.id}/potongan?periode=${slip.periodStart}` },
    { label: 'Bonus orang ini', href: `/gaji/${person.id}/bonus?periode=${slip.periodStart}` },
    { label: 'Tiadakan potongan', href: '/gaji/tiadakan' },
  ];
  switch (path) {
    case 'SOURCE':
      return [...source, { label: 'Gaji orang ini', href: `/gaji/${person.id}` }];
    case 'REOPEN':
      return [{ label: actor.fullAccess ? 'Buka kembali slip' : 'Minta buka kembali slip', href: `/gaji/slip/${slip.id}/buka` }, ...source];
    case 'PAST_CORRECTION':
      return source;
    case 'SALARY_CORRECTION':
      return actor.fullAccess ? [{ label: 'Pembetulan gaji periode lalu', href: `/gaji/${person.id}/pembetulan?keberatan=${objectionId}` }] : [];
    case 'CANCEL_PAYMENT':
      return actor.fullAccess ? [{ label: 'Batal bayar', href: `/gaji/slip/${slip.id}/batal-bayar` }, { label: 'Bayar ulang', href: `/gaji/bayar?slip=${slip.id}` }] : [];
  }
}

export async function objectionDecisionPanel(actor: Actor | null, requestId: number) {
  const data = await objectionWithSlip(requestId);
  if (!data || !isDecider(actor, data.request.typeKey, data.person)) return null;
  const { objection, slip, person } = data;
  const path = objection.fixPath as FixPath | null;
  const payment = slip.status === 'CLOSED' ? await activePaymentOf(slip.id) : null;
  return {
    slip: {
      id: slip.id, number: slip.number, period: periodLabel(slip.periodStart), name: person.name,
      state: slip.status === 'ESTIMATE' ? 'Perkiraan' : payment ? `Ditutup versi ${slip.version}, Dibayar ${longDate(payment.moneyDate)}` : `Ditutup versi ${slip.version}, belum Dibayar`,
      changedSince: slip.version !== objection.slipVersion || slip.status !== objection.slipStatus,
    },
    markedLines: (objection.lines as ObjectionLine[]).map((l) => ({ label: l.label, amount: l.amount })),
    state: objection.state,
    fixPath: path ? FIX_PATH_LABELS[path].label : null,
    fixStatus: FIX_STATUS_LABELS[objection.fixStatus as FixStatus],
    fixText: objection.fixStatus === 'FIXED' ? objection.fixText : null,
    destinations: objection.state === 'APPROVED' && objection.fixStatus === 'WAITING_FIX' && path ? destinations(path, slip, person, actor!, objection.id) : [],
    canLink: objection.state === 'APPROVED' && objection.fixStatus === 'WAITING_FIX',
    waitingDays: objection.approvedAt && objection.fixStatus === 'WAITING_FIX' ? waitingFixDays(objection.approvedAt, new Date()) : null,
  };
}

type Candidate = { kind: FixKind; id: number; text: string; at: Date };

/**
 * Catatan pembetul yang boleh ditautkan: milik orang itu, lahir/berubah sesudah keputusan (spec L4g §3.6).
 * Server menyaring; tautan dicocokkan ulang dengan daftar ini saat disimpan.
 */
async function candidatesFor(objection: ObjectionRow, slip: SlipRow, executor: Executor = db): Promise<Candidate[]> {
  const after = objection.approvedAt!;
  const who = objection.employeeId;
  const out: Candidate[] = [];
  const closes = await executor.select().from(payslipSteps)
    .where(and(eq(payslipSteps.payslipId, slip.id), eq(payslipSteps.action, 'CLOSE'), gt(payslipSteps.createdAt, after)));
  for (const s of closes) {
    const summary = (s.summary ?? {}) as { version?: number; net?: number };
    out.push({ kind: 'SLIP_VERSION', id: s.id, at: s.createdAt, text: `Slip ${slip.number ?? ''} ditutup ulang${summary.version ? ` versi ${summary.version}` : ''}${summary.net != null ? `, bersih ${rupiah(summary.net)}` : ''}` });
  }
  const lines = await executor.select({ l: payslipLines, periodStart: payslips.periodStart }).from(payslipLines).innerJoin(payslips, eq(payslips.id, payslipLines.payslipId))
    .where(and(eq(payslipLines.employeeId, who), eq(payslipLines.status, 'ACTIVE'), gt(payslipLines.createdAt, after),
      or(like(payslipLines.sourceKey, 'corr:%'), like(payslipLines.sourceKey, 'refund:%'))));
  for (const { l, periodStart } of lines) {
    out.push({ kind: 'SLIP_LINE', id: l.id, at: l.createdAt, text: `${l.label} ${l.section === 'INCOME' ? '+' : '−'}${rupiah(l.amount)} di slip periode ${periodLabel(periodStart)}` });
  }
  for (const c of await executor.select().from(salaryChanges).where(and(eq(salaryChanges.employeeId, who), gt(salaryChanges.createdAt, after), isNull(salaryChanges.cancelledAt)))) {
    out.push({ kind: 'SALARY_CHANGE', id: c.id, at: c.createdAt, text: `${c.origin === 'CORRECTION' ? 'Pembetulan gaji' : 'Perubahan gaji'} mulai ${longDate(c.effectiveFrom)}: ${c.reason}` });
  }
  for (const c of await executor.select().from(attendanceCorrections).where(and(eq(attendanceCorrections.employeeId, who), gt(attendanceCorrections.createdAt, after)))) {
    out.push({ kind: 'ATTENDANCE', id: c.id, at: c.createdAt, text: `Koreksi absen ${longDate(c.workDate)}: ${c.note}` });
  }
  for (const b of await executor.select().from(bonusEntries).where(and(eq(bonusEntries.employeeId, who), or(gt(bonusEntries.createdAt, after), gt(bonusEntries.decidedAt, after))))) {
    out.push({ kind: 'BONUS', id: b.id, at: b.decidedAt && b.decidedAt > b.createdAt ? b.decidedAt : b.createdAt, text: `Bonus ${longDate(b.occurredOn)} ${rupiah(b.amount)} (${b.status})` });
  }
  for (const d of await executor.select().from(otherDeductions).where(and(eq(otherDeductions.employeeId, who), or(gt(otherDeductions.createdAt, after), gt(otherDeductions.cancelledAt, after))))) {
    out.push({ kind: 'DEDUCTION', id: d.id, at: d.cancelledAt ?? d.createdAt, text: `Potongan Lain ${rupiah(d.amount)} ${d.cancelledAt ? '(dibatalkan/ditiadakan)' : ''}: ${d.reason}`.replace('  ', ' ') });
  }
  for (const w of await executor.select().from(payWaivers).where(and(eq(payWaivers.employeeId, who), gt(payWaivers.createdAt, after), isNull(payWaivers.cancelledAt)))) {
    out.push({ kind: 'WAIVER', id: w.id, at: w.createdAt, text: `Peniadaan ${w.kind === 'LATE' ? 'potongan telat' : 'denda'} ${longDate(w.workDate)}: ${w.reason}` });
  }
  for (const p of await executor.select().from(payslipPayments).where(and(eq(payslipPayments.payslipId, slip.id), eq(payslipPayments.status, 'ACTIVE'), gt(payslipPayments.createdAt, after)))) {
    out.push({ kind: 'PAYMENT', id: p.id, at: p.createdAt, text: `Pembayaran baru ${rupiah(p.amount)}, tanggal uang ${longDate(p.moneyDate)}` });
  }
  for (const c of await executor.select().from(offSlipClaims).where(and(eq(offSlipClaims.employeeId, who), gt(offSlipClaims.createdAt, after), inArray(offSlipClaims.status, ['WAITING', 'PAID'])))) {
    out.push({ kind: 'OFF_SLIP', id: c.id, at: c.createdAt, text: `Bayar di luar slip: ${c.label} ${rupiah(c.amount)}` });
  }
  for (const r of await executor.select().from(otherReceivables).where(and(eq(otherReceivables.employeeId, who), eq(otherReceivables.origin, 'PAST_CORRECTION'), gt(otherReceivables.createdAt, after)))) {
    out.push({ kind: 'RECEIVABLE', id: r.id, at: r.createdAt, text: `Piutang Lain: ${r.label ?? 'koreksi minus'} ${rupiah(r.amount)}` });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function linkFixScreen(actor: Actor | null, requestId: number) {
  const data = await objectionWithSlip(requestId);
  if (!data || !isDecider(actor, data.request.typeKey, data.person)) return null;
  const { objection, slip, person } = data;
  if (objection.state !== 'APPROVED') return null;
  const candidates = objection.fixStatus === 'WAITING_FIX' ? await candidatesFor(objection, slip) : [];
  return {
    requestId, name: person.name, slip: `${slip.number ?? 'Perkiraan'} · periode ${periodLabel(slip.periodStart)}`,
    fixPath: FIX_PATH_LABELS[objection.fixPath as FixPath].label, approvedAt: wibTime(objection.approvedAt!),
    linked: objection.fixStatus === 'FIXED' ? objection.fixText : null,
    candidates: candidates.map((c) => ({ kind: c.kind, id: c.id, kindLabel: FIX_KIND_LABELS[c.kind], text: c.text, at: wibTime(c.at) })),
  };
}

async function linkInTx(tx: Tx, objection: ObjectionRow, candidate: Candidate, actorAccountId: number) {
  const text = `${FIX_KIND_LABELS[candidate.kind]}: ${candidate.text}`.slice(0, 500);
  const done = await tx.update(payslipObjections).set({
    fixStatus: 'FIXED', fixKind: candidate.kind, fixId: candidate.id, fixText: text, linkedAt: new Date(), linkedByAccountId: actorAccountId,
  }).where(and(eq(payslipObjections.id, objection.id), eq(payslipObjections.fixStatus, 'WAITING_FIX'))).returning({ id: payslipObjections.id });
  if (!done.length) return false;
  await recordAudit(tx, {
    actorAccountId, entity: 'payslip_objection', entityId: objection.id, action: 'payslip_objection.link',
    before: { fixStatus: 'WAITING_FIX' }, after: { fixStatus: 'FIXED', fixKind: candidate.kind, fixId: candidate.id },
  });
  const account = (await activeHrisAccounts([objection.employeeId])).get(objection.employeeId);
  if (account) {
    await notify(tx, [account], {
      kind: 'payslip_objection.fixed', title: 'Keberatan slip Anda sudah dibetulkan.', body: text,
      entity: 'request', entityId: objection.requestId, link: `/pengajuan/${objection.requestId}`,
    }, actorAccountId);
  }
  return true;
}

/** Tautkan pembetulan (GAJ-111): penyetuju memilih catatan pembetul dari daftar yang disaring server. */
export async function linkFix(actor: Actor | null, requestId: number, input: { kind: unknown; id: unknown }): Promise<ServiceResult<{ message: string }>> {
  const data = await objectionWithSlip(requestId);
  if (!data || !isDecider(actor, data.request.typeKey, data.person)) return fail(404, 'Keberatan tidak ditemukan.');
  const { objection, slip } = data;
  if (objection.state !== 'APPROVED' || objection.fixStatus !== 'WAITING_FIX') return fail(409, 'Keberatan ini tidak sedang menunggu pembetulan.');
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(payslipObjections).where(eq(payslipObjections.id, objection.id)).for('update');
    if (!locked || locked.fixStatus !== 'WAITING_FIX') return fail(409, 'Keberatan ini sudah ditautkan.');
    const candidate = (await candidatesFor(locked, slip, tx)).find((c) => c.kind === input.kind && c.id === Number(input.id));
    if (!candidate) return fail(400, 'Catatan itu bukan milik orang ini atau lahir sebelum keputusan. Pilih dari daftar.');
    await linkInTx(tx, locked, candidate, actor!.accountId);
    return { ok: true as const, data: { message: `Pembetulan ditautkan. ${data.person.name} diberi tahu.` } };
  });
}

/** Pembayaran ulang sesudah "uang belum diterima" disetujui: tertaut otomatis (spec L4g §3.6). Dipanggil di transaksi Bayar. */
export async function autoLinkPayment(tx: Tx, slipId: number, paymentId: number, actorAccountId: number): Promise<number> {
  const waiting = await tx.select().from(payslipObjections)
    .where(and(eq(payslipObjections.payslipId, slipId), eq(payslipObjections.kind, 'NOT_RECEIVED'), eq(payslipObjections.fixStatus, 'WAITING_FIX'))).for('update');
  let linked = 0;
  for (const objection of waiting) {
    const [p] = await tx.select().from(payslipPayments).where(eq(payslipPayments.id, paymentId));
    if (!p || p.createdAt <= objection.approvedAt!) continue;
    const ok = await linkInTx(tx, objection, {
      kind: 'PAYMENT', id: p.id, at: p.createdAt, text: `Pembayaran baru ${rupiah(p.amount)}, tanggal uang ${longDate(p.moneyDate)}`,
    }, actorAccountId);
    if (ok) linked += 1;
  }
  return linked;
}

/** Keberatan "Ada yang salah" yang ditunjuk Pembetulan gaji periode lalu: Disetujui, menunggu pembetulan, milik orang ini. */
export async function correctableObjections(employeeId: number) {
  const rows = await db.select({ o: payslipObjections, number: payslips.number, periodStart: payslips.periodStart }).from(payslipObjections)
    .innerJoin(payslips, eq(payslips.id, payslipObjections.payslipId))
    .where(and(eq(payslipObjections.employeeId, employeeId), eq(payslipObjections.kind, 'WRONG'), eq(payslipObjections.state, 'APPROVED'), eq(payslipObjections.fixStatus, 'WAITING_FIX')))
    .orderBy(desc(payslipObjections.approvedAt));
  return rows.map(({ o, number, periodStart }) => ({
    id: o.id, requestId: o.requestId, periodStart, text: `Keberatan slip ${number ?? ''} periode ${periodLabel(periodStart)}: ${o.reason}`.slice(0, 200),
  }));
}

// ---- Pengingat (07.10 WIB), Beranda, dan Periksa Tutup Slip ----

async function decidersFor(typeKey: ObjectionTypeKey, person: PayrollPerson, excludeAccount: number | null): Promise<number[]> {
  const ids = await listEmployeesWithAnyAction([DECIDE_ACTION[typeKey]]);
  const accounts = await activeHrisAccounts(ids.filter((id) => id !== person.id));
  const out: number[] = [];
  for (const [employeeId, accountId] of accounts) {
    if (accountId === excludeAccount) continue;
    if (isDecider(await loadActor(accountId, employeeId), typeKey, person)) out.push(accountId);
  }
  return out;
}

/** 07.10 WIB: pengingat keberatan Menunggu dan "menunggu pembetulan"; lewat 2 hari juga ke Pemilik dan GM (GAJ-111). */
export async function runPayslipObjectionReminder(now: Date = new Date()) {
  const rows = await db.select({ o: payslipObjections, r: requests }).from(payslipObjections).innerJoin(requests, eq(requests.id, payslipObjections.requestId))
    .where(or(eq(payslipObjections.state, 'PENDING'), eq(payslipObjections.fixStatus, 'WAITING_FIX'))).orderBy(asc(payslipObjections.createdAt));
  const owners = await activeHrisAccounts(await listEmployeesWithAnyAction([]));
  let pending = 0;
  let waiting = 0;
  let overdue = 0;
  for (const { o, r } of rows) {
    const loaded = await loadSlip(o.payslipId);
    if (!loaded) continue;
    const typeKey = r.typeKey as ObjectionTypeKey;
    const slipText = `slip ${loaded.slip.number ?? '(Perkiraan)'} ${loaded.person.name} periode ${periodLabel(loaded.slip.periodStart)}`;
    if (o.state === 'PENDING') {
      const to = await decidersFor(typeKey, loaded.person, null);
      if (!to.length) continue;
      await db.transaction((tx) => notify(tx, to, {
        kind: 'payslip_objection.reminder', title: `Keberatan ${slipText} menunggu keputusan.`,
        body: OBJECTION_KIND_LABELS[o.kind as ObjectionKind], entity: 'request', entityId: o.requestId, link: `/persetujuan/${o.requestId}`,
      }, null));
      pending += 1;
      continue;
    }
    const days = waitingFixDays(o.approvedAt!, now);
    const to = new Set<number>(o.approvedByAccountId ? [o.approvedByAccountId] : []);
    if (days >= FIX_ATTENTION_DAYS) {
      overdue += 1;
      const ownerAccount = (await activeHrisAccounts([o.employeeId])).get(o.employeeId);
      for (const a of owners.values()) if (a !== ownerAccount) to.add(a);
    }
    if (!to.size) continue;
    await db.transaction((tx) => notify(tx, [...to], {
      kind: 'payslip_objection.fix_reminder', title: `Keberatan ${slipText} disetujui ${days} hari lalu, belum dibetulkan.`,
      body: 'Betulkan lalu tekan Tautkan pembetulan.', entity: 'request', entityId: o.requestId, link: `/persetujuan/${o.requestId}`,
    }, null));
    waiting += 1;
  }
  return { pending, waiting, overdue };
}

/** Kartu Beranda: keberatan yang saya setujui dan belum ditautkan; Pemilik/GM: yang lewat 2 hari (perlu perhatian). */
export async function objectionAttention(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return { mine: null, system: null };
  const rows = await db.select().from(payslipObjections).where(eq(payslipObjections.fixStatus, 'WAITING_FIX'));
  const mine = rows.filter((o) => o.approvedByAccountId === actor.accountId);
  const late = actor.fullAccess ? rows.filter((o) => o.employeeId !== actor.personId && waitingFixDays(o.approvedAt!, now) >= FIX_ATTENTION_DAYS) : [];
  return {
    mine: mine.length ? { title: `${mine.length} keberatan slip menunggu pembetulan`, detail: 'Betulkan lalu tekan Tautkan pembetulan', href: `/persetujuan/${mine[0].requestId}` } : null,
    system: late.length ? { title: `${late.length} keberatan slip disetujui lebih dari ${FIX_ATTENTION_DAYS} hari belum dibetulkan`, detail: 'Belum ditautkan pembetulannya', href: `/persetujuan/${late[0].requestId}` } : null,
  };
}

/** `/pendapatan/keberatan?dari=` (Ajukan ulang): alamat isian keberatan dengan isian lama. */
export async function objectionResubmitHref(actor: Actor | null, requestId: number): Promise<string | null> {
  if (!actor) return null;
  const [row] = await db.select({ o: payslipObjections }).from(payslipObjections).innerJoin(requests, eq(requests.id, payslipObjections.requestId))
    .where(and(eq(payslipObjections.requestId, requestId), eq(requests.submittedByAccountId, actor.accountId)));
  return row ? `/pendapatan/slip/${row.o.payslipId}/keberatan?macam=${row.o.kind}&dari=${requestId}` : null;
}

/** Jenis pengajuan untuk keberatan atas slip ini (pintu API memilih handlernya). */
export async function objectionTypeForSlip(slipId: number, kind: unknown): Promise<ObjectionTypeKey | null> {
  if (!isKind(kind)) return null;
  const loaded = await loadSlip(slipId);
  return loaded ? objectionTypeFor(kind, loaded.person) : null;
}
