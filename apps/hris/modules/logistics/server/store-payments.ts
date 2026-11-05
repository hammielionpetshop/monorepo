import Big from 'big.js';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { reportDecisions, trips, tripVisits, visitPayments, visitReportItems, visitReports } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import {
  CUT_REASON_LABELS, DECISION_LABELS, PAYMENT_LABELS, REPORT_LABELS, UNRECORDED_RED_DAYS, billOf, cleanDecision, cleanPayment, cleanPromise, cleanRecordedRef,
  cleanReport, leftToCollect, promiseOverdue, type CutReason, type Decision, type DecisionInput, type PaymentMethod, type ReportKind,
} from '../rules/store-payments';
import { rupiah } from '../rules/rates';
import { cleanReturnItems, quantityText, type ReturnItemInput } from '../rules/returned-goods';
import { addDays, reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames, type Executor } from './data';
import { runningForCrew } from './driver-trip';

// Uang dan laporan di toko (spec LT1 §13.2, §13.5, LT1b-3). Piutang kasir dibaca lewat view logistics.pos_customer_debts.

const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);

/**
 * Tagihan kunjungan terbuka per kunjungan: sisa piutang kasir (belum PAID) nota-nota yang sedang dibawanya.
 * Kunjungan tanpa piutang = 0 (lunas di kasir).
 */
export async function openVisitBills(visitIds: number[], executor: Executor = db): Promise<Map<number, number>> {
  const bills = new Map<number, number>();
  if (!visitIds.length) return bills;
  const rows = await executor.execute<{ visit_id: number; remaining_amount: number | null }>(sql`
    select l.visit_id, d.remaining_amount
    from logistics.trip_visit_notes l
    join logistics.delivery_notes n on n.id = l.note_id and n.kind = 'SALE'
    left join logistics.pos_customer_debts d on d.transaction_id = n.doc_id and d.status <> 'PAID'
    where l.visit_id in (${ids(visitIds)}) and l.active`);
  for (const id of visitIds) bills.set(id, billOf(rows.filter((r) => Number(r.visit_id) === id && r.remaining_amount != null).map((r) => Number(r.remaining_amount))));
  return bills;
}

export type PaymentInput = { method?: string | null; partialAmount?: number | null; promiseDate?: string | null };

/**
 * Catat cara bayar bersama Terkirim (§13.5 butir 2, 3). Dipanggil processVisit di dalam transaksinya, sebelum tautan
 * surat jalan diakhiri (tagihan dihitung dari tautan yang masih aktif). Bukti transfer sudah diunggah pemanggil.
 */
export async function recordPayment(
  tx: Tx, visit: { id: number; tripId: number; customerId: number }, input: PaymentInput, proofFileId: string | null,
  by: { employeeId: number; accountId: number }, now: Date,
): Promise<{ ok: true } | { ok: false; status: 400; error: string }> {
  const bill = (await openVisitBills([visit.id], tx)).get(visit.id) ?? 0;
  const clean = cleanPayment(bill, input.method, input.partialAmount);
  if (!clean.ok) return { ok: false, status: 400, error: clean.error };
  if (clean.method === 'TRANSFER' && !proofFileId) return { ok: false, status: 400, error: 'Foto bukti transfer wajib.' };
  // Janji bayar sisa (§14.2 butir 5) untuk Bayar sebagian / Tempo.
  const promise = cleanPromise(clean.method, input.promiseDate, wibDate(now));
  if (!promise.ok) return { ok: false, status: 400, error: promise.error };
  await tx.insert(visitPayments).values({
    visitId: visit.id, tripId: visit.tripId, customerId: visit.customerId, method: clean.method, billAmount: bill, receivedAmount: clean.received,
    proofPhotoFileId: clean.method === 'TRANSFER' ? proofFileId : null, recordedByEmployeeId: by.employeeId, recordedByAccountId: by.accountId,
    recordedAt: now, promiseDate: promise.date,
  });
  return { ok: true };
}

/**
 * Laporan kunjungan sesudah Terkirim (§13.5 butir 4, 5): awak trip Berjalan, foto wajib; kantor diberi tahu. Retur wajib
 * rincian barang (nama, jumlah, satuan) dan pemilik barang = cabang asal surat jalan kunjungan itu (§14.1 butir 2).
 */
export async function addVisitReport(
  actor: Actor | null, tripId: number, visitId: number,
  input: { kind?: string | null; note?: string | null; items?: ReturnItemInput[] | null; ownerBranchId?: number | null }, photo: File | null,
): Promise<ServiceResult> {
  const clean = cleanReport(input.kind, input.note);
  if (!clean.ok) return fail(400, clean.error);
  const items = clean.kind === 'RETURN' ? cleanReturnItems(input.items) : null;
  if (items && !items.ok) return fail(400, items.error);
  const running = await runningForCrew(actor, tripId);
  if (!running.ok) return running;
  const me = actor!;
  const [visit] = await db.select().from(tripVisits).where(and(eq(tripVisits.id, visitId), eq(tripVisits.tripId, tripId))).limit(1);
  if (!visit) return fail(404, 'Kunjungan tidak ditemukan di trip ini.');
  if (visit.customerId == null) return fail(400, 'Laporan kunjungan hanya untuk toko.');
  if (visit.status !== 'DELIVERED') return fail(409, 'Laporan kunjungan dibuat sesudah Terkirim.');
  let ownerBranchId: number | null = null;
  if (clean.kind === 'RETURN') {
    const origins = [...new Set((await db.execute<{ origin_branch_id: number }>(sql`
      select n.origin_branch_id from logistics.trip_visit_notes l join logistics.delivery_notes n on n.id = l.note_id
      where l.visit_id = ${visitId}`)).map((r) => Number(r.origin_branch_id)))];
    if (origins.length === 1) ownerBranchId = origins[0];
    else if (origins.length > 1) {
      if (input.ownerBranchId == null || !origins.includes(input.ownerBranchId)) return fail(400, 'Pilih barang retur milik cabang mana.');
      ownerBranchId = input.ownerBranchId;
    }
  }
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const customerId = visit.customerId;
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(visitReports).values({
      visitId, tripId, customerId, kind: clean.kind, note: clean.note, photoFileId: upload.data.id, carriedBack: clean.kind === 'RETURN',
      ownerBranchId, reportedByEmployeeId: me.personId,
    }).returning({ id: visitReports.id });
    if (items?.ok) await tx.insert(visitReportItems).values(items.items.map((i) => ({ reportId: row.id, ...i })));
    await notify(tx, await accountsOf(await listEmployeesWithAnyAction(['logistics.delivery_note.decide', 'logistics.note_cut.decide'])), {
      kind: 'logistics.visit_report', title: `${REPORT_LABELS[clean.kind]}: ${visit.destinationName} (trip ${running.loaded.trip.number})`,
      body: `${clean.note ? `${clean.note}. ` : ''}Finance memutuskan potong nota di Laporan Toko.`,
      link: '/logistik/laporan-toko', entity: 'visit_report', entityId: row.id,
    }, me.accountId);
    return { ok: true as const, data: undefined };
  });
}

export type NoteOption = { id: number; number: string; amount: number; otherCuts: number };
export type DecisionView = {
  id: number; decision: Decision; label: string; noteId: number | null; noteNumber: string | null; amount: number | null;
  reason: CutReason | null; reasonLabel: string | null; note: string | null; by: string; on: IsoDate; at: string;
  /** Alasan ubah keputusan terakhir dan berapa kali diubah. */
  changeReason: string | null; changes: number;
  recorded: { ref: string; by: string; on: IsoDate } | null;
};

/** Nama karyawan pemilik akun HRIS. */
async function accountNames(accountIds: number[], executor: Executor = db): Promise<Map<number, string>> {
  if (!accountIds.length) return new Map();
  const rows = await executor.execute<{ account_id: number; name: string }>(sql`
    select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
    where l.app_code = 'hris' and l.account_id in (${ids([...new Set(accountIds)])})`);
  return new Map(rows.map((r) => [Number(r.account_id), r.name]));
}

/** Keputusan yang berlaku per laporan (§14.2 butir 1), lengkap dengan nomor nota dan nama pemutus / pencatat. */
async function decisionsOf(reportIds: number[], executor: Executor = db) {
  const rows = reportIds.length
    ? await executor.select().from(reportDecisions).where(inArray(reportDecisions.reportId, reportIds)).orderBy(reportDecisions.id)
    : [];
  const noteIds = [...new Set(rows.map((r) => r.noteId).filter((id): id is number => id != null))];
  const [numbers, names] = await Promise.all([
    noteIds.length ? executor.execute<{ id: number; number: string }>(sql`select id, number from logistics.delivery_notes where id in (${ids(noteIds)})`) : [],
    accountNames(rows.flatMap((r) => [r.decidedByAccountId, ...(r.recordedByAccountId ? [r.recordedByAccountId] : [])]), executor),
  ]);
  const numberOf = new Map(numbers.map((n) => [Number(n.id), n.number]));
  return (reportId: number): DecisionView | null => {
    const mine = rows.filter((r) => r.reportId === reportId);
    const r = mine.find((x) => !x.replacedAt);
    if (!r) return null;
    return {
      id: r.id, decision: r.decision as Decision, label: DECISION_LABELS[r.decision as Decision], noteId: r.noteId,
      noteNumber: r.noteId ? numberOf.get(r.noteId) ?? '-' : null, amount: r.amount, reason: r.reason as CutReason | null,
      reasonLabel: r.reason ? CUT_REASON_LABELS[r.reason as CutReason] : null, note: r.note, by: names.get(r.decidedByAccountId) ?? '-',
      on: wibDate(r.decidedAt), at: wibClock(r.decidedAt), changeReason: r.changeReason, changes: mine.length - 1,
      recorded: r.recordedAt ? { ref: r.recordedRef ?? '-', by: names.get(r.recordedByAccountId ?? 0) ?? '-', on: wibDate(r.recordedAt) } : null,
    };
  };
}

/**
 * Nota kasir (surat jalan SALE) kunjungan untuk keputusan potong nota: nominal kasir sekarang (atau saat masuk trip bila
 * nota tidak lagi terbaca sebagai kiriman truk) dan potongan lain yang masih berlaku, di luar laporan ini.
 */
async function notesForDecision(executor: Executor, visitId: number, reportId: number): Promise<NoteOption[]> {
  const rows = await executor.execute<{ id: number; number: string; amount: number; cuts: number }>(sql`
    select distinct n.id, n.number, coalesce(s.payable_amount, n.amount_at_trip, 0)::int as amount,
      (select coalesce(sum(c.amount), 0)::int from logistics.report_decisions c
        where c.note_id = n.id and c.decision = 'CUT' and c.replaced_at is null and c.report_id <> ${reportId}) as cuts
    from logistics.trip_visit_notes l join logistics.delivery_notes n on n.id = l.note_id and n.kind = 'SALE'
    left join logistics.pos_truck_sales s on s.id = n.doc_id
    where l.visit_id = ${visitId}
    order by n.number`);
  return rows.map((r) => ({ id: Number(r.id), number: r.number, amount: Number(r.amount), otherCuts: Number(r.cuts) }));
}

/**
 * Keputusan atas laporan toko (§14.2 butir 1): pemegang `logistics.note_cut.decide` (Finance; Pemilik/GM), bukan pelapornya.
 * Laporan ditutup dengan ringkasan keputusan. Ubah keputusan: alasan wajib dan hanya selama belum Sudah dicatat di kasir;
 * baris lama ditandai Diganti.
 */
export async function decideVisitReport(
  actor: Actor | null, reportId: number, input: DecisionInput & { changeReason?: string | null },
): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.note_cut.decide')) return fail(403, FORBIDDEN);
  const [report] = await db.select().from(visitReports).where(eq(visitReports.id, reportId)).limit(1);
  if (!report) return fail(404, 'Laporan tidak ditemukan.');
  if (report.reportedByEmployeeId === actor.personId) return fail(403, 'Laporan yang Anda buat sendiri diputuskan orang lain.');
  const [current] = await db.select().from(reportDecisions)
    .where(and(eq(reportDecisions.reportId, reportId), isNull(reportDecisions.replacedAt))).limit(1);
  let changeReason: string | null = null;
  if (current) {
    if (current.recordedAt) return fail(409, 'Keputusan ini sudah dicatat di kasir, tidak bisa diubah.');
    changeReason = (input.changeReason ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
    const problem = reasonProblem(changeReason);
    if (problem) return fail(400, problem.replace('Alasan', 'Alasan ubah keputusan'));
  } else if (report.closedAt) return fail(409, 'Laporan ini sudah ditandai selesai sebelum ada keputusan potong nota.');
  const notes = await notesForDecision(db, report.visitId, reportId);
  const clean = cleanDecision(report.kind as ReportKind, input, notes);
  if (!clean.ok) return fail(400, clean.error);
  const v = clean.value;
  const number = notes.find((n) => n.id === v.noteId)?.number ?? '-';
  const tail = v.note ? `: ${v.note}` : '';
  const summary = v.decision === 'CUT' ? `Potong nota ${number} ${rupiah(v.amount ?? 0)} (${CUT_REASON_LABELS[v.reason!]})${tail}`
    : v.decision === 'RETURN_BO' ? `Dicatat lewat Retur BO (${number})${tail}` : `Tidak dipotong${tail}`;
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      if (current) {
        const [old] = await tx.update(reportDecisions).set({ replacedAt: now })
          .where(and(eq(reportDecisions.id, current.id), isNull(reportDecisions.replacedAt), isNull(reportDecisions.recordedAt)))
          .returning({ id: reportDecisions.id });
        if (!old) return fail(409, 'Keputusan ini baru saja berubah atau sudah dicatat di kasir. Muat ulang halaman.');
      }
      await tx.insert(reportDecisions).values({
        reportId, decision: v.decision, noteId: v.noteId, amount: v.amount, reason: v.reason, note: v.note,
        decidedByAccountId: actor.accountId, decidedAt: now, changeReason,
      });
      await tx.update(visitReports).set({ closedAt: now, closedByAccountId: actor.accountId, closeNote: summary.slice(0, 500) })
        .where(eq(visitReports.id, reportId));
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'report_decisions_current')) return fail(409, 'Laporan ini baru saja diputuskan orang lain. Muat ulang halaman.');
    throw error;
  }
}

/** Sudah dicatat di kasir (§14.2 butir 3): pemegang `logistics.note_cut.decide`, nomor referensi wajib; sesudahnya terkunci. */
export async function markDecisionRecorded(actor: Actor | null, decisionId: number, ref: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.note_cut.decide')) return fail(403, FORBIDDEN);
  const clean = cleanRecordedRef(ref);
  if (!clean.ok) return fail(400, clean.error);
  const [row] = await db.update(reportDecisions).set({ recordedAt: new Date(), recordedByAccountId: actor.accountId, recordedRef: clean.ref })
    .where(and(
      eq(reportDecisions.id, decisionId), isNull(reportDecisions.replacedAt), isNull(reportDecisions.recordedAt),
      inArray(reportDecisions.decision, ['CUT', 'RETURN_BO']),
    ))
    .returning({ id: reportDecisions.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Keputusan ini sudah dicatat, sudah diganti, atau tidak perlu dicatat di kasir.');
}

/**
 * Koreksi cara bayar salah tekan (§14.2 butir 4; LOG-116): awak selama trip Berjalan dan belum Menuju Garasi; sesudahnya
 * pemegang `logistics.store_payment.correct` (Kepala Gudang; Pemilik/GM). Alasan wajib. Tagihan tetap tagihan saat Terkirim.
 * Baris lama ditandai Diganti (tidak dihapus); pemegang Uang dari Toko (Finance) diberi tahu.
 */
export async function correctPayment(
  actor: Actor | null, visitId: number, input: PaymentInput & { reason?: string | null }, proof: File | null,
): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const [current] = await db.select().from(visitPayments)
    .where(and(eq(visitPayments.visitId, visitId), isNull(visitPayments.replacedAt))).limit(1);
  if (!current) return fail(404, 'Cara bayar kunjungan ini tidak ditemukan.');
  const crew = await runningForCrew(actor, current.tripId);
  if (!crew.ok && !can(actor, 'logistics.store_payment.correct')) {
    return fail(403, 'Awak hanya bisa mengoreksi cara bayar selama trip berjalan dan belum Menuju Garasi; sesudahnya oleh Kepala Gudang, Pemilik, atau GM.');
  }
  if (current.billAmount === 0) return fail(409, 'Kunjungan ini tidak punya tagihan.');
  const reason = (input.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const problem = reasonProblem(reason);
  if (problem) return fail(400, problem);
  const clean = cleanPayment(current.billAmount, input.method, input.partialAmount);
  if (!clean.ok) return fail(400, clean.error);
  const now = new Date();
  const promise = cleanPromise(clean.method, input.promiseDate, wibDate(now));
  if (!promise.ok) return fail(400, promise.error);
  if (clean.method === current.method && clean.received === current.receivedAmount && promise.date === current.promiseDate && !proof) {
    return fail(400, 'Tidak ada yang berubah.');
  }
  let proofId: string | null = null;
  if (clean.method === 'TRANSFER') {
    if (proof) {
      const upload = await saveUpload(actor, proof);
      if (!upload.ok) return fail(400, upload.status === 400 ? `Bukti transfer: ${upload.error}` : upload.error);
      proofId = upload.data.id;
    } else if (current.proofPhotoFileId) proofId = current.proofPhotoFileId;
    else return fail(400, 'Foto bukti transfer wajib.');
  }
  return db.transaction(async (tx) => {
    const [old] = await tx.update(visitPayments).set({ replacedAt: now })
      .where(and(eq(visitPayments.id, current.id), isNull(visitPayments.replacedAt))).returning({ id: visitPayments.id });
    if (!old) return fail(409, 'Cara bayar ini baru saja dikoreksi orang lain. Muat ulang halaman.');
    await tx.insert(visitPayments).values({
      visitId, tripId: current.tripId, customerId: current.customerId, method: clean.method, billAmount: current.billAmount,
      receivedAmount: clean.received, proofPhotoFileId: proofId, recordedByEmployeeId: actor.personId, recordedByAccountId: actor.accountId,
      recordedAt: now, promiseDate: promise.date, correctionOfId: current.id, correctionReason: reason,
    });
    const [info] = await tx.select({ name: tripVisits.destinationName, number: trips.number, date: trips.tripDate })
      .from(tripVisits).innerJoin(trips, eq(trips.id, tripVisits.tripId)).where(eq(tripVisits.id, visitId));
    await notify(tx, await accountsOf(await listEmployeesWithAnyAction(['logistics.store_payment.view'])), {
      kind: 'logistics.payment_corrected', title: `Cara bayar ${info?.name ?? 'toko'} dikoreksi (trip ${info?.number ?? '-'})`,
      body: `${PAYMENT_LABELS[current.method as PaymentMethod]} → ${PAYMENT_LABELS[clean.method]}. Alasan: ${reason}`,
      link: `/logistik/uang-toko${info?.date ? `?tanggal=${info.date}` : ''}`, entity: 'visit_payment', entityId: current.id,
    }, actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

export type VisitPaymentView = {
  visitId: number; method: PaymentMethod; label: string; bill: number; received: number; left: number; proofUrl: string | null;
  /** Janji bayar sisa (§14.2 butir 5) dan alasan koreksi terakhir (§14.2 butir 4). */
  promiseDate: IsoDate | null; correctionReason: string | null;
};
export type VisitReportView = {
  id: number; kind: ReportKind; label: string; note: string | null; carriedBack: boolean; photoUrl: string; by: string; at: string;
  closed: boolean; closeNote: string | null;
  /** Rincian barang retur (§14.1 butir 2). */
  items: { name: string; quantity: string; unit: string }[];
  /** Keputusan yang berlaku (§14.2 butir 1). */
  decision: DecisionView | null;
};

async function itemsOf(reportIds: number[], executor: Executor = db) {
  const rows = reportIds.length ? await executor.select().from(visitReportItems).where(inArray(visitReportItems.reportId, reportIds)).orderBy(visitReportItems.id) : [];
  return (reportId: number) => rows.filter((r) => r.reportId === reportId).map((r) => ({ name: r.name, quantity: quantityText(r.quantity), unit: r.unit }));
}

/** Cara bayar + laporan kunjungan untuk tampilan trip (rincian trip, Trip Saya). */
export async function visitMoneyView(tripId: number, visitIds: number[], executor: Executor = db) {
  const [payments, reports] = await Promise.all([
    visitIds.length ? executor.select().from(visitPayments).where(and(inArray(visitPayments.visitId, visitIds), isNull(visitPayments.replacedAt))) : [],
    visitIds.length ? executor.select().from(visitReports).where(inArray(visitReports.visitId, visitIds)).orderBy(visitReports.id) : [],
  ]);
  const [names, itemsFor, decisionOf] = await Promise.all([
    reports.length ? peopleNames() : new Map<number, string>(), itemsOf(reports.map((r) => r.id), executor), decisionsOf(reports.map((r) => r.id), executor),
  ]);
  const photo = (fileId: string) => `/api/logistics/photo?trip=${tripId}&file=${fileId}`;
  return {
    payments: new Map(payments.map((p): [number, VisitPaymentView] => [p.visitId, {
      visitId: p.visitId, method: p.method as PaymentMethod, label: PAYMENT_LABELS[p.method as PaymentMethod], bill: p.billAmount, received: p.receivedAmount,
      left: leftToCollect(p.method as PaymentMethod, p.billAmount, p.receivedAmount), proofUrl: p.proofPhotoFileId ? photo(p.proofPhotoFileId) : null,
      promiseDate: p.promiseDate, correctionReason: p.correctionReason,
    }])),
    reports: reports.map((r) => ({
      visitId: r.visitId,
      view: {
        id: r.id, kind: r.kind as ReportKind, label: REPORT_LABELS[r.kind as ReportKind], note: r.note, carriedBack: r.carriedBack,
        photoUrl: photo(r.photoFileId), by: names.get(r.reportedByEmployeeId) ?? '-', at: wibClock(r.reportedAt), closed: !!r.closedAt, closeNote: r.closeNote,
        items: itemsFor(r.id), decision: decisionOf(r.id),
      } satisfies VisitReportView,
    })),
  };
}

/** Foto bukti transfer trip ini (pemegang `logistics.store_payment.view` boleh membukanya). */
export async function paymentProofIds(tripId: number): Promise<string[]> {
  const rows = await db.select({ id: visitPayments.proofPhotoFileId }).from(visitPayments)
    .where(and(eq(visitPayments.tripId, tripId), isNotNull(visitPayments.proofPhotoFileId)));
  return rows.map((r) => r.id).filter((id): id is string => !!id);
}

/** Foto bukti transfer dan laporan kunjungan milik trip ini (untuk pintu foto trip). */
export async function moneyPhotoIds(tripId: number): Promise<string[]> {
  const [payments, reports] = await Promise.all([
    db.select({ id: visitPayments.proofPhotoFileId }).from(visitPayments).where(and(eq(visitPayments.tripId, tripId), isNotNull(visitPayments.proofPhotoFileId))),
    db.select({ id: visitReports.photoFileId }).from(visitReports).where(eq(visitReports.tripId, tripId)),
  ]);
  return [...payments, ...reports].map((r) => r.id).filter((id): id is string => !!id);
}

export type StorePaymentRow = {
  id: number; visitId: number; tripId: number; tripNumber: string; crew: string; store: string; customerId: number; notes: string[]; method: PaymentMethod; label: string;
  bill: number; received: number; left: number; proofUrl: string | null; at: string;
  /** Janji bayar sisa; lewat = tanggal lewat dan piutang kasir nota kunjungan masih ada (§14.2 butir 5). */
  promiseDate: IsoDate | null; overdue: boolean; correctionReason: string | null;
};

/**
 * Uang dari toko (§13.5 butir 6) untuk Finance: cara bayar per kunjungan pada tanggal trip, dan jumlah per trip.
 * Hanya daftar; pencatatan ke kasir tetap diketik Finance (pemeriksaan uang Tahap 4).
 */
export async function storePaymentsScreen(actor: Actor | null, date: IsoDate) {
  if (!actor || !can(actor, 'logistics.store_payment.view')) return null;
  const rows = await db.execute<{
    id: number; trip_id: number; number: string; customer_id: number; store: string | null; method: PaymentMethod; bill_amount: number;
    received_amount: number; proof_photo_file_id: string | null; recorded_at: string; notes: string | null; recorded_by_employee_id: number;
    visit_id: number; promise_date: string | null; correction_reason: string | null; debt_left: number | null;
  }>(sql`
    select p.id, p.visit_id, p.trip_id, t.number, p.customer_id, v.destination_name as store, p.method, p.bill_amount, p.received_amount, p.proof_photo_file_id,
      p.recorded_at, p.recorded_by_employee_id, p.promise_date::text as promise_date, p.correction_reason,
      (select string_agg(n.number, ', ' order by n.number) from logistics.trip_visit_notes l join logistics.delivery_notes n on n.id = l.note_id
        where l.visit_id = p.visit_id) as notes,
      (select coalesce(sum(d.remaining_amount), 0)::int from logistics.trip_visit_notes l join logistics.delivery_notes n on n.id = l.note_id and n.kind = 'SALE'
        join logistics.pos_customer_debts d on d.transaction_id = n.doc_id and d.status <> 'PAID' where l.visit_id = p.visit_id) as debt_left
    from logistics.visit_payments p join logistics.trips t on t.id = p.trip_id join logistics.trip_visits v on v.id = p.visit_id
    where t.trip_date = ${date}::date and p.replaced_at is null
    order by t.number, p.recorded_at`);
  const today = wibDate(new Date());
  const tripIds = [...new Set(rows.map((r) => Number(r.trip_id)))];
  const [crewRows, names] = await Promise.all([
    db.execute<{ trip_id: number; employee_id: number; role: string }>(sql`
      select trip_id, employee_id, role from logistics.trip_crew where trip_id in (${ids(tripIds)}) and removed_at is null order by role desc, id`),
    peopleNames(),
  ]);
  const crewOf = (tripId: number) => crewRows.filter((c) => Number(c.trip_id) === tripId).map((c) => names.get(Number(c.employee_id)) ?? '-').join(', ');
  const list: StorePaymentRow[] = rows.map((r) => {
    const bill = Number(r.bill_amount);
    const received = Number(r.received_amount);
    return {
      id: Number(r.id), visitId: Number(r.visit_id), tripId: Number(r.trip_id), tripNumber: r.number, crew: crewOf(Number(r.trip_id)), store: r.store ?? '-', customerId: Number(r.customer_id),
      notes: r.notes ? r.notes.split(', ') : [], method: r.method, label: PAYMENT_LABELS[r.method], bill, received, left: leftToCollect(r.method, bill, received),
      proofUrl: r.proof_photo_file_id ? `/api/logistics/photo?trip=${r.trip_id}&file=${r.proof_photo_file_id}` : null, at: wibClock(new Date(r.recorded_at)),
      promiseDate: r.promise_date, overdue: promiseOverdue(r.promise_date, today, Number(r.debt_left ?? 0)), correctionReason: r.correction_reason,
    };
  });
  const sum = (items: StorePaymentRow[], pick: (r: StorePaymentRow) => number) => Number(items.reduce((n, r) => n.plus(pick(r)), new Big(0)));
  const totalsOf = (items: StorePaymentRow[]) => ({
    cash: sum(items.filter((r) => r.method === 'CASH' || r.method === 'PARTIAL'), (r) => r.received),
    transfer: sum(items.filter((r) => r.method === 'TRANSFER'), (r) => r.received),
    left: sum(items, (r) => r.left),
    visits: items.length,
  });
  return {
    date, rows: list,
    trips: tripIds.map((id) => {
      const items = list.filter((r) => r.tripId === id);
      return { tripId: id, number: items[0].tripNumber, crew: items[0].crew, ...totalsOf(items) };
    }),
    totals: totalsOf(list),
    canCorrect: can(actor, 'logistics.store_payment.correct'),
  };
}

export type ReportRow = VisitReportView & {
  tripId: number; tripNumber: string; store: string; customerId: number; on: IsoDate; closedBy: string | null;
  /** Nota kunjungan ini untuk dipilih saat memutuskan; `own` = laporan pembaca sendiri (tidak boleh ia putuskan). */
  noteOptions: NoteOption[]; own: boolean;
};

/** Laporan Toko (§13.5 butir 5): yang masih terbuka (paling lama di atas) dan 30 terakhir yang sudah selesai. */
export async function visitReportsScreen(actor: Actor | null) {
  if (!actor || !(can(actor, 'logistics.delivery_note.view') || can(actor, 'logistics.delivery_note.decide'))) return null;
  const [open, closed, names] = await Promise.all([
    db.select().from(visitReports).where(isNull(visitReports.closedAt)).orderBy(visitReports.reportedAt).limit(300),
    db.select().from(visitReports).where(isNotNull(visitReports.closedAt)).orderBy(desc(visitReports.closedAt)).limit(30),
    peopleNames(),
  ]);
  const all = [...open, ...closed];
  const [visits, closers] = await Promise.all([
    all.length ? db.execute<{ id: number; destination_name: string; trip_id: number; number: string }>(sql`
      select v.id, v.destination_name, v.trip_id, t.number from logistics.trip_visits v join logistics.trips t on t.id = v.trip_id
      where v.id in (${ids([...new Set(all.map((r) => r.visitId))])})`) : [],
    closed.length ? db.execute<{ account_id: number; name: string }>(sql`
      select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
      where l.app_code = 'hris' and l.account_id in (${ids([...new Set(closed.map((r) => r.closedByAccountId!))])})`) : [],
  ]);
  const canDecide = can(actor, 'logistics.note_cut.decide');
  const [itemsFor, decisionOf] = await Promise.all([itemsOf(all.filter((r) => r.kind === 'RETURN').map((r) => r.id)), decisionsOf(all.map((r) => r.id))]);
  // Pilihan nota hanya untuk laporan yang masih bisa diputuskan / diubah (belum dicatat di kasir).
  const decidable = canDecide ? all.filter((r) => !r.closedAt || (decisionOf(r.id) && !decisionOf(r.id)!.recorded)) : [];
  const options = new Map(await Promise.all(decidable.map(async (r) => [r.id, await notesForDecision(db, r.visitId, r.id)] as const)));
  const visitOf = new Map(visits.map((v) => [Number(v.id), v]));
  const closerOf = new Map(closers.map((c) => [Number(c.account_id), c.name]));
  const view = (r: typeof visitReports.$inferSelect): ReportRow => {
    const v = visitOf.get(r.visitId);
    return {
      id: r.id, kind: r.kind as ReportKind, label: REPORT_LABELS[r.kind as ReportKind], note: r.note, carriedBack: r.carriedBack,
      photoUrl: `/api/logistics/photo?trip=${r.tripId}&file=${r.photoFileId}`, by: names.get(r.reportedByEmployeeId) ?? '-', at: wibClock(r.reportedAt),
      on: wibDate(r.reportedAt), closed: !!r.closedAt, closeNote: r.closeNote, items: itemsFor(r.id), closedBy: r.closedByAccountId ? closerOf.get(r.closedByAccountId) ?? '-' : null,
      tripId: r.tripId, tripNumber: v?.number ?? '-', store: v?.destination_name ?? '-', customerId: r.customerId,
      decision: decisionOf(r.id), noteOptions: options.get(r.id) ?? [], own: r.reportedByEmployeeId === actor.personId,
    };
  };
  return { open: open.map(view), closed: closed.map(view), canDecide };
}

/** Angka Beranda: laporan toko yang belum diputuskan (pemegang hak potong nota, §14.2 butir 1). */
export async function openReportCount(actor: Actor | null): Promise<number> {
  if (!actor || !can(actor, 'logistics.note_cut.decide')) return 0;
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from logistics.visit_reports where closed_at is null`);
  return Number(row?.n ?? 0);
}


export type ToRecordRow = DecisionView & {
  reportId: number; reportLabel: string; reportNote: string | null; photoUrl: string; tripId: number; tripNumber: string; store: string;
  customerId: number; days: number; red: boolean;
};

/**
 * Perlu dicatat di kasir (§14.2 butir 3): keputusan Potong nota / Retur BO yang berlaku dan belum dicatat (paling lama di
 * atas; merah bila lebih dari 3 hari), dan 30 terakhir yang sudah dicatat.
 */
export async function toRecordScreen(actor: Actor | null) {
  if (!actor || !can(actor, 'logistics.note_cut.decide')) return null;
  const [waiting, done] = await Promise.all([
    db.select().from(reportDecisions)
      .where(and(isNull(reportDecisions.replacedAt), isNull(reportDecisions.recordedAt), inArray(reportDecisions.decision, ['CUT', 'RETURN_BO'])))
      .orderBy(reportDecisions.decidedAt).limit(300),
    db.select().from(reportDecisions).where(and(isNull(reportDecisions.replacedAt), isNotNull(reportDecisions.recordedAt)))
      .orderBy(desc(reportDecisions.recordedAt)).limit(30),
  ]);
  const reportIds = [...new Set([...waiting, ...done].map((d) => d.reportId))];
  const [reports, decisionOf] = await Promise.all([
    reportIds.length ? db.execute<{ id: number; kind: ReportKind; note: string | null; photo_file_id: string; trip_id: number; number: string; store: string; customer_id: number }>(sql`
      select r.id, r.kind, r.note, r.photo_file_id, r.trip_id, t.number, v.destination_name as store, r.customer_id
      from logistics.visit_reports r join logistics.trip_visits v on v.id = r.visit_id join logistics.trips t on t.id = r.trip_id
      where r.id in (${ids(reportIds)})`) : [],
    decisionsOf(reportIds),
  ]);
  const reportOf = new Map(reports.map((r) => [Number(r.id), r]));
  const today = wibDate(new Date());
  const view = (d: typeof reportDecisions.$inferSelect): ToRecordRow | null => {
    const decision = decisionOf(d.reportId);
    const r = reportOf.get(d.reportId);
    if (!decision || !r) return null;
    const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(decision.on)) / 86_400_000));
    return {
      ...decision, reportId: d.reportId, reportLabel: REPORT_LABELS[r.kind], reportNote: r.note,
      photoUrl: `/api/logistics/photo?trip=${r.trip_id}&file=${r.photo_file_id}`, tripId: Number(r.trip_id), tripNumber: r.number, store: r.store,
      customerId: Number(r.customer_id), days, red: !decision.recorded && days > UNRECORDED_RED_DAYS,
    };
  };
  const clean = (rows: (ToRecordRow | null)[]) => rows.filter((r): r is ToRecordRow => !!r);
  return { waiting: clean(waiting.map(view)), done: clean(done.map(view)), redDays: UNRECORDED_RED_DAYS };
}

/** Angka Beranda (§14.2 butir 3): keputusan belum dicatat di kasir, dan yang sudah lebih dari 3 hari. */
export async function unrecordedCounts(actor: Actor | null): Promise<{ waiting: number; red: number }> {
  if (!actor || !can(actor, 'logistics.note_cut.decide')) return { waiting: 0, red: 0 };
  const redBefore = addDays(wibDate(new Date()), -UNRECORDED_RED_DAYS);
  const [row] = await db.execute<{ waiting: number; red: number }>(sql`
    select count(*)::int as waiting,
      count(*) filter (where (decided_at at time zone 'Asia/Jakarta')::date < ${redBefore}::date)::int as red
    from logistics.report_decisions
    where replaced_at is null and recorded_at is null and decision in ('CUT', 'RETURN_BO')`);
  return { waiting: Number(row?.waiting ?? 0), red: Number(row?.red ?? 0) };
}
