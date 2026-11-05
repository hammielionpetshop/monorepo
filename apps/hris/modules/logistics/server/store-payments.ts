import Big from 'big.js';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { tripVisits, visitPayments, visitReportItems, visitReports } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import {
  PAYMENT_LABELS, REPORT_LABELS, billOf, cleanPayment, cleanReport, leftToCollect, type PaymentMethod, type ReportKind,
} from '../rules/store-payments';
import { cleanReturnItems, quantityText, type ReturnItemInput } from '../rules/returned-goods';
import { reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, peopleNames, type Executor } from './data';
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

export type PaymentInput = { method?: string | null; partialAmount?: number | null };

/**
 * Catat cara bayar bersama Terkirim (§13.5 butir 2, 3). Dipanggil processVisit di dalam transaksinya, sebelum tautan
 * surat jalan diakhiri (tagihan dihitung dari tautan yang masih aktif). Bukti transfer sudah diunggah pemanggil.
 */
export async function recordPayment(
  tx: Tx, visit: { id: number; tripId: number; customerId: number }, input: PaymentInput, proofFileId: string | null, employeeId: number, now: Date,
): Promise<{ ok: true } | { ok: false; status: 400; error: string }> {
  const bill = (await openVisitBills([visit.id], tx)).get(visit.id) ?? 0;
  const clean = cleanPayment(bill, input.method, input.partialAmount);
  if (!clean.ok) return { ok: false, status: 400, error: clean.error };
  if (clean.method === 'TRANSFER' && !proofFileId) return { ok: false, status: 400, error: 'Foto bukti transfer wajib.' };
  await tx.insert(visitPayments).values({
    visitId: visit.id, tripId: visit.tripId, customerId: visit.customerId, method: clean.method, billAmount: bill, receivedAmount: clean.received,
    proofPhotoFileId: clean.method === 'TRANSFER' ? proofFileId : null, recordedByEmployeeId: employeeId, recordedAt: now,
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
    await notify(tx, await accountsOf(await listEmployeesWithAnyAction(['logistics.delivery_note.decide'])), {
      kind: 'logistics.visit_report', title: `${REPORT_LABELS[clean.kind]}: ${visit.destinationName} (trip ${running.loaded.trip.number})`,
      body: `${clean.note ? `${clean.note}. ` : ''}Putuskan potong nota di Back Office, lalu tandai Selesai di Laporan Toko.`,
      link: '/logistik/laporan-toko', entity: 'visit_report', entityId: row.id,
    }, me.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Tutup laporan kunjungan (§13.5 butir 5): pemegang `logistics.delivery_note.decide`, catatan wajib. */
export async function closeVisitReport(actor: Actor | null, reportId: number, note: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.delivery_note.decide')) return fail(403, FORBIDDEN);
  const text = note.replace(/\s+/g, ' ').trim();
  const problem = reasonProblem(text);
  if (problem) return fail(400, problem.replace('Alasan', 'Catatan'));
  const [row] = await db.update(visitReports).set({ closedAt: new Date(), closedByAccountId: actor.accountId, closeNote: text.slice(0, 500) })
    .where(and(eq(visitReports.id, reportId), isNull(visitReports.closedAt))).returning({ id: visitReports.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Laporan ini sudah ditandai selesai.');
}

export type VisitPaymentView = { method: PaymentMethod; label: string; bill: number; received: number; left: number; proofUrl: string | null };
export type VisitReportView = {
  id: number; kind: ReportKind; label: string; note: string | null; carriedBack: boolean; photoUrl: string; by: string; at: string;
  closed: boolean; closeNote: string | null;
  /** Rincian barang retur (§14.1 butir 2). */
  items: { name: string; quantity: string; unit: string }[];
};

async function itemsOf(reportIds: number[], executor: Executor = db) {
  const rows = reportIds.length ? await executor.select().from(visitReportItems).where(inArray(visitReportItems.reportId, reportIds)).orderBy(visitReportItems.id) : [];
  return (reportId: number) => rows.filter((r) => r.reportId === reportId).map((r) => ({ name: r.name, quantity: quantityText(r.quantity), unit: r.unit }));
}

/** Cara bayar + laporan kunjungan untuk tampilan trip (rincian trip, Trip Saya). */
export async function visitMoneyView(tripId: number, visitIds: number[], executor: Executor = db) {
  const [payments, reports] = await Promise.all([
    visitIds.length ? executor.select().from(visitPayments).where(inArray(visitPayments.visitId, visitIds)) : [],
    visitIds.length ? executor.select().from(visitReports).where(inArray(visitReports.visitId, visitIds)).orderBy(visitReports.id) : [],
  ]);
  const [names, itemsFor] = await Promise.all([reports.length ? peopleNames() : new Map<number, string>(), itemsOf(reports.map((r) => r.id), executor)]);
  const photo = (fileId: string) => `/api/logistics/photo?trip=${tripId}&file=${fileId}`;
  return {
    payments: new Map(payments.map((p): [number, VisitPaymentView] => [p.visitId, {
      method: p.method as PaymentMethod, label: PAYMENT_LABELS[p.method as PaymentMethod], bill: p.billAmount, received: p.receivedAmount,
      left: leftToCollect(p.method as PaymentMethod, p.billAmount, p.receivedAmount), proofUrl: p.proofPhotoFileId ? photo(p.proofPhotoFileId) : null,
    }])),
    reports: reports.map((r) => ({
      visitId: r.visitId,
      view: {
        id: r.id, kind: r.kind as ReportKind, label: REPORT_LABELS[r.kind as ReportKind], note: r.note, carriedBack: r.carriedBack,
        photoUrl: photo(r.photoFileId), by: names.get(r.reportedByEmployeeId) ?? '-', at: wibClock(r.reportedAt), closed: !!r.closedAt, closeNote: r.closeNote,
        items: itemsFor(r.id),
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
  id: number; tripId: number; tripNumber: string; crew: string; store: string; customerId: number; notes: string[]; method: PaymentMethod; label: string;
  bill: number; received: number; left: number; proofUrl: string | null; at: string;
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
  }>(sql`
    select p.id, p.trip_id, t.number, p.customer_id, v.destination_name as store, p.method, p.bill_amount, p.received_amount, p.proof_photo_file_id,
      p.recorded_at, p.recorded_by_employee_id,
      (select string_agg(n.number, ', ' order by n.number) from logistics.trip_visit_notes l join logistics.delivery_notes n on n.id = l.note_id
        where l.visit_id = p.visit_id) as notes
    from logistics.visit_payments p join logistics.trips t on t.id = p.trip_id join logistics.trip_visits v on v.id = p.visit_id
    where t.trip_date = ${date}::date
    order by t.number, p.recorded_at`);
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
      id: Number(r.id), tripId: Number(r.trip_id), tripNumber: r.number, crew: crewOf(Number(r.trip_id)), store: r.store ?? '-', customerId: Number(r.customer_id),
      notes: r.notes ? r.notes.split(', ') : [], method: r.method, label: PAYMENT_LABELS[r.method], bill, received, left: leftToCollect(r.method, bill, received),
      proofUrl: r.proof_photo_file_id ? `/api/logistics/photo?trip=${r.trip_id}&file=${r.proof_photo_file_id}` : null, at: wibClock(new Date(r.recorded_at)),
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
  };
}

export type ReportRow = VisitReportView & { tripId: number; tripNumber: string; store: string; customerId: number; on: IsoDate; closedBy: string | null };

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
  const itemsFor = await itemsOf(all.filter((r) => r.kind === 'RETURN').map((r) => r.id));
  const visitOf = new Map(visits.map((v) => [Number(v.id), v]));
  const closerOf = new Map(closers.map((c) => [Number(c.account_id), c.name]));
  const view = (r: typeof visitReports.$inferSelect): ReportRow => {
    const v = visitOf.get(r.visitId);
    return {
      id: r.id, kind: r.kind as ReportKind, label: REPORT_LABELS[r.kind as ReportKind], note: r.note, carriedBack: r.carriedBack,
      photoUrl: `/api/logistics/photo?trip=${r.tripId}&file=${r.photoFileId}`, by: names.get(r.reportedByEmployeeId) ?? '-', at: wibClock(r.reportedAt),
      on: wibDate(r.reportedAt), closed: !!r.closedAt, closeNote: r.closeNote, items: itemsFor(r.id), closedBy: r.closedByAccountId ? closerOf.get(r.closedByAccountId) ?? '-' : null,
      tripId: r.tripId, tripNumber: v?.number ?? '-', store: v?.destination_name ?? '-', customerId: r.customerId,
    };
  };
  return { open: open.map(view), closed: closed.map(view), canClose: can(actor, 'logistics.delivery_note.decide') };
}

/** Angka Beranda: laporan toko yang belum ditutup (pemegang hak putus surat jalan). */
export async function openReportCount(actor: Actor | null): Promise<number> {
  if (!actor || !can(actor, 'logistics.delivery_note.decide')) return 0;
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from logistics.visit_reports where closed_at is null`);
  return Number(row?.n ?? 0);
}

