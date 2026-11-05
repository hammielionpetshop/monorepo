import Big from 'big.js';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { reportDecisions, trips, tripVisits, visitNoteBills, visitPayments, visitReportItems, visitReports } from '@petshop/logistics';
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
import { CHECKED_LOCK, paymentChecked } from './money-checks';
import { canCorrectSelf } from './self-delivery-money';

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

/** Tagihan per nota (nota kasir SALE berpiutang belum lunas) kunjungan terbuka, urut nota paling lama dulu (spec LT1 §16.1 butir 2). */
async function openNoteBills(visitId: number, executor: Executor) {
  const rows = await executor.execute<{ note_id: number; doc_id: number; remaining_amount: number }>(sql`
    select n.id as note_id, n.doc_id, sum(d.remaining_amount)::int as remaining_amount
    from logistics.trip_visit_notes l
    join logistics.delivery_notes n on n.id = l.note_id and n.kind = 'SALE'
    join logistics.pos_customer_debts d on d.transaction_id = n.doc_id and d.status <> 'PAID'
    where l.visit_id = ${visitId} and l.active
    group by n.id, n.doc_id
    order by n.doc_id`);
  return rows.map((r) => ({ noteId: Number(r.note_id), transactionId: Number(r.doc_id), bill: Math.max(0, Math.round(Number(r.remaining_amount))) }));
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
  // Tagihan per nota saat Terkirim: dasar pembagian uang dan tanda pelunasan POS di Terima Uang (spec LT1 §16.1 butir 2, 7).
  const notes = bill > 0 ? (await openNoteBills(visit.id, tx)).filter((n) => n.bill > 0) : [];
  if (notes.length) await tx.insert(visitNoteBills).values(notes.map((n) => ({ visitId: visit.id, noteId: n.noteId, transactionId: n.transactionId, billAmount: n.bill })));
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
  const trxIds = [...new Set(rows.map((r) => r.transactionId).filter((id): id is number => id != null))];
  const [numbers, trxNumbers, names] = await Promise.all([
    noteIds.length ? executor.execute<{ id: number; number: string }>(sql`select id, number from logistics.delivery_notes where id in (${ids(noteIds)})`) : [],
    trxIds.length ? executor.execute<{ id: number; number: string }>(sql`
      select distinct on (transaction_id) transaction_id as id, trx_number as number from logistics.self_trip_stops where transaction_id in (${ids(trxIds)})`) : [],
    accountNames(rows.flatMap((r) => [r.decidedByAccountId, ...(r.recordedByAccountId ? [r.recordedByAccountId] : [])]), executor),
  ]);
  const numberOf = new Map(numbers.map((n) => [Number(n.id), n.number]));
  const trxNumberOf = new Map(trxNumbers.map((n) => [Number(n.id), n.number]));
  return (reportId: number): DecisionView | null => {
    const mine = rows.filter((r) => r.reportId === reportId);
    const r = mine.find((x) => !x.replacedAt);
    if (!r) return null;
    // Laporan antar sendiri menunjuk nota kasir langsung (transaction_id); pilihannya memakai id itu juga (spec LT1 §15.4).
    const noteId = r.noteId ?? r.transactionId;
    return {
      id: r.id, decision: r.decision as Decision, label: DECISION_LABELS[r.decision as Decision], noteId,
      noteNumber: r.noteId ? numberOf.get(r.noteId) ?? '-' : r.transactionId ? trxNumberOf.get(r.transactionId) ?? '-' : null,
      amount: r.amount, reason: r.reason as CutReason | null,
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
 * Nota kasir tujuan antar sendiri untuk keputusan potong nota (spec LT1 §15.4 butir 3): id = id transaksi kasir, nominal kasir
 * sekarang (atau saat dibawa), potongan lain yang berlaku di nota itu di luar laporan ini.
 */
async function selfNotesForDecision(executor: Executor, stopId: number, reportId: number): Promise<NoteOption[]> {
  const rows = await executor.execute<{ id: number; number: string; amount: number; cuts: number }>(sql`
    select x.transaction_id as id, x.trx_number as number, coalesce(s.payable_amount, x.amount_at_start, 0)::int as amount,
      (select coalesce(sum(c.amount), 0)::int from logistics.report_decisions c
        where c.transaction_id = x.transaction_id and c.decision = 'CUT' and c.replaced_at is null and c.report_id <> ${reportId}) as cuts
    from logistics.self_trip_stops x left join logistics.pos_courier_sales s on s.id = x.transaction_id
    where x.id = ${stopId}`);
  return rows.map((r) => ({ id: Number(r.id), number: r.number, amount: Number(r.amount), otherCuts: Number(r.cuts) }));
}

/** Pilihan nota untuk laporan truk (surat jalan) atau antar sendiri (nota kasir). */
const notesFor = (executor: Executor, report: { id: number; visitId: number | null; selfStopId: number | null }) =>
  report.visitId != null ? notesForDecision(executor, report.visitId, report.id) : selfNotesForDecision(executor, report.selfStopId!, report.id);

type ReportPlace = { tripHref: string; tripNumber: string; store: string; photoUrl: string; source: string | null };

/** Asal laporan: kunjungan trip truk atau tujuan antar sendiri (nomor perjalanan, nama tujuan, tautan, foto). */
async function placesOf(reports: { id: number; visitId: number | null; selfStopId: number | null; tripId: number | null; selfTripId: number | null; photoFileId: string }[]) {
  const visitIds = [...new Set(reports.map((r) => r.visitId).filter((id): id is number => id != null))];
  const stopIds = [...new Set(reports.map((r) => r.selfStopId).filter((id): id is number => id != null))];
  const [visits, stops] = await Promise.all([
    visitIds.length ? db.execute<{ id: number; destination_name: string; trip_id: number; number: string }>(sql`
      select v.id, v.destination_name, v.trip_id, t.number from logistics.trip_visits v join logistics.trips t on t.id = v.trip_id
      where v.id in (${ids(visitIds)})`) : [],
    stopIds.length ? db.execute<{ id: number; destination_name: string; trip_id: number; number: string; branch_id: number; branch: string | null }>(sql`
      select x.id, x.destination_name, t.id as trip_id, t.number, t.branch_id, b.name as branch
      from logistics.self_trip_stops x join logistics.self_trips t on t.id = x.trip_id left join hris.branches b on b.id = t.branch_id
      where x.id in (${ids(stopIds)})`) : [],
  ]);
  const visitOf = new Map(visits.map((v) => [Number(v.id), v]));
  const stopOf = new Map(stops.map((s) => [Number(s.id), s]));
  return (r: (typeof reports)[number]): ReportPlace => {
    if (r.visitId != null) {
      const v = visitOf.get(r.visitId);
      return {
        tripHref: `/logistik/trip/${r.tripId}`, tripNumber: v?.number ?? '-', store: v?.destination_name ?? '-', source: null,
        photoUrl: `/api/logistics/photo?trip=${r.tripId}&file=${r.photoFileId}`,
      };
    }
    const s = stopOf.get(r.selfStopId ?? 0);
    return {
      tripHref: `/logistik/antar-sendiri/kantor?tab=DONE${s ? `&cabang=${s.branch_id}` : ''}`, tripNumber: s?.number ?? '-', store: s?.destination_name ?? '-',
      source: `Antar sendiri${s?.branch ? ` · ${s.branch}` : ''}`, photoUrl: `/api/logistics/self-photo?trip=${r.selfTripId}&kind=report&report=${r.id}`,
    };
  };
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
  const notes = await notesFor(db, report);
  const clean = cleanDecision(report.kind as ReportKind, input, notes);
  if (!clean.ok) return fail(400, clean.error);
  const v = clean.value;
  const self = report.visitId == null;
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
        reportId, decision: v.decision, noteId: self ? null : v.noteId, transactionId: self ? v.noteId : null, amount: v.amount, reason: v.reason, note: v.note,
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
  if (await paymentChecked('TRUCK', current.id)) return fail(409, CHECKED_LOCK);
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
      visitId: r.visitId!,
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

export type PaymentSource = 'TRUCK' | 'SELF';
export type PaymentSourceFilter = 'ALL' | PaymentSource;
export type StorePaymentRow = {
  key: string; source: PaymentSource; id: number;
  /** Truk: kunjungan; antar sendiri: tujuan (stop). */
  visitId: number | null; stopId: number | null;
  tripId: number; tripHref: string; tripNumber: string; crew: string; branch: string | null; store: string; customerId: number | null; notes: string[];
  method: PaymentMethod; label: string; bill: number; received: number; left: number; proofUrl: string | null; at: string;
  /** Janji bayar sisa; lewat = tanggal lewat dan piutang kasir nota kunjungan masih ada (§14.2 butir 5). */
  promiseDate: IsoDate | null; overdue: boolean; correctionReason: string | null; canCorrect: boolean;
};
export type PaymentTripSummary = {
  key: string; source: PaymentSource; tripId: number; href: string; number: string; crew: string; cash: number; transfer: number; left: number; visits: number;
  /** Antar sendiri: tunai sudah diterima laci cabang? (null = truk / belum Foto 3 / tanpa tunai). */
  cashReceived: boolean | null; running: boolean;
};

/** Cara bayar antar sendiri pada tanggal mulai perjalanan (spec LT1 §15.4 butir 1). */
async function selfPaymentRows(actor: Actor, date: IsoDate, branchId: number | null, today: IsoDate) {
  const rows = await db.execute<{
    id: number; stop_id: number; trip_id: number; number: string; branch_id: number; branch: string | null; employee_id: number; status: string;
    cash_amount: number; cash_received_at: string | null; customer_id: number | null; store: string; trx_number: string; method: PaymentMethod;
    bill_amount: number; received_amount: number; proof_photo_file_id: string | null; recorded_at: string; promise_date: string | null;
    correction_reason: string | null; debt_left: number | null;
  }>(sql`
    select p.id, p.stop_id, p.trip_id, t.number, t.branch_id, b.name as branch, t.employee_id, t.status, t.cash_amount, t.cash_received_at,
      p.customer_id, x.destination_name as store, x.trx_number, p.method, p.bill_amount, p.received_amount, p.proof_photo_file_id, p.recorded_at,
      p.promise_date::text as promise_date, p.correction_reason,
      (select coalesce(sum(d.remaining_amount), 0)::int from logistics.pos_customer_debts d where d.transaction_id = p.transaction_id and d.status <> 'PAID') as debt_left
    from logistics.self_trip_payments p join logistics.self_trips t on t.id = p.trip_id join logistics.self_trip_stops x on x.id = p.stop_id
    left join hris.branches b on b.id = t.branch_id
    where (t.started_at at time zone 'Asia/Jakarta')::date = ${date}::date and p.replaced_at is null
      ${branchId != null ? sql`and t.branch_id = ${branchId}` : sql``}
    order by t.number, p.recorded_at`);
  const names = rows.length ? await peopleNames() : new Map<number, string>();
  const list: StorePaymentRow[] = rows.map((r) => {
    const bill = Number(r.bill_amount);
    const received = Number(r.received_amount);
    return {
      key: `SELF-${r.id}`, source: 'SELF', id: Number(r.id), visitId: null, stopId: Number(r.stop_id), tripId: Number(r.trip_id),
      tripHref: `/logistik/antar-sendiri/kantor?tab=DONE&cabang=${r.branch_id}`, tripNumber: r.number, crew: names.get(Number(r.employee_id)) ?? '-',
      branch: r.branch, store: r.store, customerId: r.customer_id != null ? Number(r.customer_id) : null, notes: [r.trx_number], method: r.method,
      label: PAYMENT_LABELS[r.method], bill, received, left: leftToCollect(r.method, bill, received),
      proofUrl: r.proof_photo_file_id ? `/api/logistics/self-photo?trip=${r.trip_id}&kind=proof&stop=${r.stop_id}` : null, at: wibClock(new Date(r.recorded_at)),
      promiseDate: r.promise_date, overdue: promiseOverdue(r.promise_date, today, Number(r.debt_left ?? 0)), correctionReason: r.correction_reason,
      canCorrect: bill > 0 && canCorrectSelf(actor, { status: r.status, employeeId: Number(r.employee_id), branchId: Number(r.branch_id) }),
    };
  });
  const trips = new Map(rows.map((r) => [Number(r.trip_id), r]));
  return { list, tripInfo: (id: number) => trips.get(id)! };
}

/**
 * Uang dari toko (§13.5 butir 6) untuk Finance: cara bayar per kunjungan pada tanggal trip, dan jumlah per trip. Sejak LT3d
 * juga cara bayar antar sendiri (tunai ke laci cabang, spec LT1 §15.4 butir 1); saringan sumber dan cabang (antar sendiri).
 * Hanya daftar; pencatatan ke kasir tetap diketik Finance (pemeriksaan uang Tahap 4).
 */
export async function storePaymentsScreen(
  actor: Actor | null, date: IsoDate, filter: { source: PaymentSourceFilter; branchId: number | null } = { source: 'ALL', branchId: null },
) {
  if (!actor || !can(actor, 'logistics.store_payment.view')) return null;
  const today = wibDate(new Date());
  const withTruck = filter.source !== 'SELF' && filter.branchId == null;
  const [rows, self, branches] = await Promise.all([withTruck ? db.execute<{
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
    order by t.number, p.recorded_at`) : Promise.resolve([]),
  filter.source !== 'TRUCK' ? selfPaymentRows(actor, date, filter.branchId, today) : Promise.resolve(null),
  db.execute<{ id: number; name: string }>(sql`select id, name from hris.branches where kasir_branch_id is not null order by name`),
  ]);
  const tripIds = [...new Set(rows.map((r) => Number(r.trip_id)))];
  const [crewRows, names] = await Promise.all([
    db.execute<{ trip_id: number; employee_id: number; role: string }>(sql`
      select trip_id, employee_id, role from logistics.trip_crew where trip_id in (${ids(tripIds)}) and removed_at is null order by role desc, id`),
    peopleNames(),
  ]);
  const crewOf = (tripId: number) => crewRows.filter((c) => Number(c.trip_id) === tripId).map((c) => names.get(Number(c.employee_id)) ?? '-').join(', ');
  const canCorrectTruck = can(actor, 'logistics.store_payment.correct');
  const truck: StorePaymentRow[] = rows.map((r) => {
    const bill = Number(r.bill_amount);
    const received = Number(r.received_amount);
    return {
      key: `TRUCK-${r.id}`, source: 'TRUCK', id: Number(r.id), visitId: Number(r.visit_id), stopId: null, tripId: Number(r.trip_id),
      tripHref: `/logistik/trip/${r.trip_id}`, tripNumber: r.number, crew: crewOf(Number(r.trip_id)), branch: null, store: r.store ?? '-', customerId: Number(r.customer_id),
      notes: r.notes ? r.notes.split(', ') : [], method: r.method, label: PAYMENT_LABELS[r.method], bill, received, left: leftToCollect(r.method, bill, received),
      proofUrl: r.proof_photo_file_id ? `/api/logistics/photo?trip=${r.trip_id}&file=${r.proof_photo_file_id}` : null, at: wibClock(new Date(r.recorded_at)),
      promiseDate: r.promise_date, overdue: promiseOverdue(r.promise_date, today, Number(r.debt_left ?? 0)), correctionReason: r.correction_reason,
      canCorrect: canCorrectTruck && bill > 0,
    };
  });
  const selfRows = self?.list ?? [];
  const list = [...truck, ...selfRows];
  const sum = (items: StorePaymentRow[], pick: (r: StorePaymentRow) => number) => Number(items.reduce((n, r) => n.plus(pick(r)), new Big(0)));
  const cashOfRows = (items: StorePaymentRow[]) => sum(items.filter((r) => r.method === 'CASH' || r.method === 'PARTIAL'), (r) => r.received);
  const totalsOf = (items: StorePaymentRow[]) => ({
    cash: cashOfRows(items),
    transfer: sum(items.filter((r) => r.method === 'TRANSFER'), (r) => r.received),
    left: sum(items, (r) => r.left),
    visits: items.length,
  });
  const selfTripIds = [...new Set(selfRows.map((r) => r.tripId))];
  const trips: PaymentTripSummary[] = [
    ...tripIds.map((id) => {
      const items = truck.filter((r) => r.tripId === id);
      return {
        key: `TRUCK-${id}`, source: 'TRUCK' as const, tripId: id, href: items[0].tripHref, number: items[0].tripNumber, crew: items[0].crew,
        cashReceived: null, running: false, ...totalsOf(items),
      };
    }),
    ...selfTripIds.map((id) => {
      const items = selfRows.filter((r) => r.tripId === id);
      const info = self!.tripInfo(id);
      return {
        key: `SELF-${id}`, source: 'SELF' as const, tripId: id, href: items[0].tripHref, number: items[0].tripNumber,
        crew: `${items[0].crew}${items[0].branch ? ` · ${items[0].branch}` : ''}`, running: info.status === 'RUNNING',
        cashReceived: info.status === 'RUNNING' || Number(info.cash_amount) === 0 ? null : !!info.cash_received_at, ...totalsOf(items),
      };
    }),
  ];
  return {
    date, rows: list, trips, source: filter.source, branchId: filter.branchId,
    branches: branches.map((b) => ({ id: Number(b.id), name: b.name })),
    totals: { ...totalsOf(list), cashTruck: cashOfRows(truck), cashSelf: cashOfRows(selfRows) },
  };
}

export type ReportRow = VisitReportView & {
  /** Tautan ke trip truk atau layar kantor antar sendiri; `source` = "Antar sendiri · cabang" untuk laporan antar sendiri. */
  tripHref: string; tripNumber: string; store: string; source: string | null; customerId: number | null; on: IsoDate; closedBy: string | null;
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
  const [placeOf, closers] = await Promise.all([
    placesOf(all),
    closed.length ? db.execute<{ account_id: number; name: string }>(sql`
      select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
      where l.app_code = 'hris' and l.account_id in (${ids([...new Set(closed.map((r) => r.closedByAccountId!))])})`) : [],
  ]);
  const canDecide = can(actor, 'logistics.note_cut.decide');
  const [itemsFor, decisionOf] = await Promise.all([itemsOf(all.filter((r) => r.kind === 'RETURN').map((r) => r.id)), decisionsOf(all.map((r) => r.id))]);
  // Pilihan nota hanya untuk laporan yang masih bisa diputuskan / diubah (belum dicatat di kasir).
  const decidable = canDecide ? all.filter((r) => !r.closedAt || (decisionOf(r.id) && !decisionOf(r.id)!.recorded)) : [];
  const options = new Map(await Promise.all(decidable.map(async (r) => [r.id, await notesFor(db, r)] as const)));
  const closerOf = new Map(closers.map((c) => [Number(c.account_id), c.name]));
  const view = (r: typeof visitReports.$inferSelect): ReportRow => {
    const place = placeOf(r);
    return {
      id: r.id, kind: r.kind as ReportKind, label: REPORT_LABELS[r.kind as ReportKind], note: r.note, carriedBack: r.carriedBack,
      photoUrl: place.photoUrl, by: names.get(r.reportedByEmployeeId) ?? '-', at: wibClock(r.reportedAt),
      on: wibDate(r.reportedAt), closed: !!r.closedAt, closeNote: r.closeNote, items: itemsFor(r.id), closedBy: r.closedByAccountId ? closerOf.get(r.closedByAccountId) ?? '-' : null,
      tripHref: place.tripHref, tripNumber: place.tripNumber, store: place.store, source: place.source, customerId: r.customerId,
      decision: decisionOf(r.id), noteOptions: options.get(r.id) ?? [], own: r.reportedByEmployeeId === actor.personId,
    };
  };
  return { open: open.map(view), closed: closed.map(view), canDecide };
}

/** Angka Beranda: laporan toko yang belum diputuskan (pemegang hak potong nota, §14.2 butir 1). */
export async function openReportCount(actor: Actor | null): Promise<number> {
  if (!actor || !can(actor, 'logistics.note_cut.decide')) return 0;
  return countOpenReports();
}

/** Hitung laporan toko belum diputuskan tanpa pemeriksaan hak (Dashboard Logistik). */
export async function countOpenReports(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from logistics.visit_reports where closed_at is null`);
  return Number(row?.n ?? 0);
}


export type ToRecordRow = DecisionView & {
  reportId: number; reportLabel: string; reportNote: string | null; photoUrl: string; tripHref: string; tripNumber: string; store: string;
  source: string | null; customerId: number | null; days: number; red: boolean;
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
    reportIds.length ? db.select().from(visitReports).where(inArray(visitReports.id, reportIds)) : [],
    decisionsOf(reportIds),
  ]);
  const placeOf = await placesOf(reports);
  const reportOf = new Map(reports.map((r) => [r.id, r]));
  const today = wibDate(new Date());
  const view = (d: typeof reportDecisions.$inferSelect): ToRecordRow | null => {
    const decision = decisionOf(d.reportId);
    const r = reportOf.get(d.reportId);
    if (!decision || !r) return null;
    const place = placeOf(r);
    const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(decision.on)) / 86_400_000));
    return {
      ...decision, reportId: d.reportId, reportLabel: REPORT_LABELS[r.kind as ReportKind], reportNote: r.note,
      photoUrl: place.photoUrl, tripHref: place.tripHref, tripNumber: place.tripNumber, store: place.store, source: place.source,
      customerId: r.customerId, days, red: !decision.recorded && days > UNRECORDED_RED_DAYS,
    };
  };
  const clean = (rows: (ToRecordRow | null)[]) => rows.filter((r): r is ToRecordRow => !!r);
  return { waiting: clean(waiting.map(view)), done: clean(done.map(view)), redDays: UNRECORDED_RED_DAYS };
}

/** Angka Beranda (§14.2 butir 3): keputusan belum dicatat di kasir, dan yang sudah lebih dari 3 hari. */
export async function unrecordedCounts(actor: Actor | null): Promise<{ waiting: number; red: number }> {
  if (!actor || !can(actor, 'logistics.note_cut.decide')) return { waiting: 0, red: 0 };
  return countUnrecorded();
}

/** Hitung potong nota / retur belum dicatat di kasir tanpa pemeriksaan hak (Dashboard Logistik). */
export async function countUnrecorded(): Promise<{ waiting: number; red: number }> {
  const redBefore = addDays(wibDate(new Date()), -UNRECORDED_RED_DAYS);
  const [row] = await db.execute<{ waiting: number; red: number }>(sql`
    select count(*)::int as waiting,
      count(*) filter (where (decided_at at time zone 'Asia/Jakarta')::date < ${redBefore}::date)::int as red
    from logistics.report_decisions
    where replaced_at is null and recorded_at is null and decision in ('CUT', 'RETURN_BO')`);
  return { waiting: Number(row?.waiting ?? 0), red: Number(row?.red ?? 0) };
}
