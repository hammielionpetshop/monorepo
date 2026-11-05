import { and, eq, isNull, sql } from 'drizzle-orm';
import { deliveryNoteEvents, goodsReceipts, tripCrew } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { ageDays } from '../rules/delivery-notes';
import {
  RESULT_LABELS, cleanReceipt, nextStep, pendingRed, quantityText, stepsNeeded, type ReceiptResult, type ReceiptStep,
} from '../rules/returned-goods';
import { reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames, type Executor } from './data';
import { homeKasirBranchId } from './trip-notes';

// Barang kembali dan tertunda (spec LT1 §14.1, LT2a). Daftar dibaca langsung dari trip yang Selesai; yang disimpan hanya
// penerimaannya (logistics.goods_receipts) dan tutup tertunda (riwayat surat jalan PENDING_CLOSED).

const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const photoUrl = (tripId: number, fileId: string) => `/api/logistics/photo?trip=${tripId}&file=${fileId}`;

export type SourceKind = 'NOTE' | 'RETURN';
const VISIT_LABELS: Record<string, string> = { TOMORROW: 'Kirim Besok', FAILED: 'Gagal' };

type SourceRow = {
  kind: SourceKind; sourceId: number; tripId: number; tripNumber: string; tripDate: IsoDate; finishedAt: Date; destination: string;
  ownerBranchId: number | null; what: string; detail: string | null; reportPhoto: string | null; items: { name: string; quantity: string; unit: string }[];
};

/**
 * Sumber barang kembali (§14.1 butir 1) dari trip Selesai sejak `logistics.returned_goods_from`:
 * - NOTE: surat jalan di kunjungan Kirim Besok / Gagal, yang barangnya memang dimuat (asal Gudang, atau Ambil barang di
 *   cabang asalnya selesai) dan tidak dicoba lagi di trip yang sama;
 * - RETURN: laporan kunjungan Retur (dibawa pulang).
 */
async function sources(filter: { kind: SourceKind; id: number } | null, executor: Executor = db): Promise<SourceRow[]> {
  const today = wibDate(new Date());
  const from = String(await settingOn<string>('logistics.returned_goods_from', today));
  const home = await homeKasirBranchId(executor);
  const fromAt = `${from}T00:00:00+07:00`;
  const [notes, returns] = await Promise.all([
    !filter || filter.kind === 'NOTE' ? executor.execute<{
      source_id: number; trip_id: number; number: string; trip_date: string; finished_at: string; destination_name: string; visit_status: string;
      reason: string | null; note_number: string; note_kind: string; origin_branch_id: number;
    }>(sql`
      select l.id as source_id, t.id as trip_id, t.number, t.trip_date::text as trip_date, t.finished_at, v.destination_name, v.status as visit_status,
        v.reason, n.number as note_number, n.kind as note_kind, n.origin_branch_id
      from logistics.trip_visit_notes l
      join logistics.trip_visits v on v.id = l.visit_id and v.status in ('TOMORROW', 'FAILED')
      join logistics.trips t on t.id = v.trip_id and t.status = 'DONE' and t.finished_at >= ${fromAt}::timestamptz
      join logistics.delivery_notes n on n.id = l.note_id
      where (n.origin_branch_id = ${home ?? -1} or exists (select 1 from logistics.trip_pickups p
          where p.trip_id = t.id and p.origin_branch_id = n.origin_branch_id and p.status = 'DONE'))
        and not exists (select 1 from logistics.trip_visit_notes l2 join logistics.trip_visits v2 on v2.id = l2.visit_id
          where l2.note_id = l.note_id and v2.trip_id = t.id and l2.id > l.id)
        ${filter ? sql`and l.id = ${filter.id}` : sql``}
      order by t.finished_at, l.id`) : [],
    !filter || filter.kind === 'RETURN' ? executor.execute<{
      source_id: number; trip_id: number; number: string; trip_date: string; finished_at: string; destination_name: string;
      owner_branch_id: number | null; note: string | null; photo_file_id: string;
    }>(sql`
      select r.id as source_id, t.id as trip_id, t.number, t.trip_date::text as trip_date, t.finished_at, v.destination_name,
        r.owner_branch_id, r.note, r.photo_file_id
      from logistics.visit_reports r
      join logistics.trips t on t.id = r.trip_id and t.status = 'DONE' and t.finished_at >= ${fromAt}::timestamptz
      join logistics.trip_visits v on v.id = r.visit_id
      where r.kind = 'RETURN' ${filter ? sql`and r.id = ${filter.id}` : sql``}
      order by t.finished_at, r.id`) : [],
  ]);
  const items = returns.length ? await executor.execute<{ report_id: number; name: string; quantity: string; unit: string }>(sql`
    select report_id, name, quantity::text as quantity, unit from logistics.visit_report_items
    where report_id in (${ids(returns.map((r) => Number(r.source_id)))}) order by id`) : [];
  return [
    ...notes.map((n): SourceRow => ({
      kind: 'NOTE', sourceId: Number(n.source_id), tripId: Number(n.trip_id), tripNumber: n.number, tripDate: n.trip_date, finishedAt: new Date(n.finished_at),
      destination: n.destination_name, ownerBranchId: Number(n.origin_branch_id),
      what: `${VISIT_LABELS[n.visit_status] ?? n.visit_status}: ${n.note_kind === 'SALE' ? 'nota' : 'PO Internal'} ${n.note_number}`,
      detail: n.reason, reportPhoto: null, items: [],
    })),
    ...returns.map((r): SourceRow => ({
      kind: 'RETURN', sourceId: Number(r.source_id), tripId: Number(r.trip_id), tripNumber: r.number, tripDate: r.trip_date, finishedAt: new Date(r.finished_at),
      destination: r.destination_name, ownerBranchId: r.owner_branch_id == null ? null : Number(r.owner_branch_id), what: 'Retur dibawa pulang',
      detail: r.note, reportPhoto: photoUrl(Number(r.trip_id), r.photo_file_id),
      items: items.filter((i) => Number(i.report_id) === Number(r.source_id)).map((i) => ({ name: i.name, quantity: quantityText(i.quantity), unit: i.unit })),
    })),
  ];
}

export type ReceiptView = { step: ReceiptStep; result: ReceiptResult; label: string; note: string | null; by: string; at: string; on: IsoDate; photoUrl: string };
export type ReturnedGoodsRow = {
  key: string; kind: SourceKind; sourceId: number; tripId: number; tripNumber: string; tripDate: IsoDate; destination: string; what: string;
  detail: string | null; reportPhoto: string | null; items: { name: string; quantity: string; unit: string }[];
  owner: string; ownerIsHome: boolean; next: ReceiptStep | null; receipts: ReceiptView[]; age: number; mismatch: boolean;
};

async function rowsOf(list: SourceRow[], executor: Executor = db): Promise<ReturnedGoodsRow[]> {
  if (!list.length) return [];
  const tripIds = [...new Set(list.map((s) => s.tripId))];
  const [home, receipts, branches, names, accounts] = await Promise.all([
    homeKasirBranchId(executor),
    executor.select().from(goodsReceipts).where(sql`${goodsReceipts.tripId} in (${ids(tripIds)})`).orderBy(goodsReceipts.id),
    executor.execute<{ id: number; name: string }>(sql`select id, name from hris.kasir_branches`),
    peopleNames(),
    executor.execute<{ account_id: number; name: string }>(sql`
      select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id where l.app_code = 'hris'`),
  ]);
  const branchName = new Map(branches.map((b) => [Number(b.id), b.name]));
  const accountName = new Map(accounts.map((a) => [Number(a.account_id), a.name]));
  const today = wibDate(new Date());
  return list.map((s) => {
    const mine = receipts.filter((r) => r.sourceKind === s.kind && r.sourceId === s.sourceId);
    const needed = stepsNeeded(s.ownerBranchId, home);
    const ownerId = s.ownerBranchId ?? home;
    return {
      key: `${s.kind}-${s.sourceId}`, kind: s.kind, sourceId: s.sourceId, tripId: s.tripId, tripNumber: s.tripNumber, tripDate: s.tripDate,
      destination: s.destination, what: s.what, detail: s.detail, reportPhoto: s.reportPhoto, items: s.items,
      owner: ownerId != null ? branchName.get(ownerId) ?? `Cabang #${ownerId}` : 'Gudang', ownerIsHome: needed.length === 1,
      next: nextStep(needed, mine.map((r) => r.step as ReceiptStep)),
      receipts: mine.map((r) => ({
        step: r.step as ReceiptStep, result: r.result as ReceiptResult, label: RESULT_LABELS[r.result as ReceiptResult], note: r.note,
        by: (r.receivedByEmployeeId != null ? names.get(r.receivedByEmployeeId) : null) ?? accountName.get(r.receivedByAccountId) ?? '-',
        at: wibClock(r.receivedAt), on: wibDate(r.receivedAt), photoUrl: photoUrl(s.tripId, r.photoFileId),
      })),
      age: ageDays(wibDate(s.finishedAt), today), mismatch: mine.some((r) => r.result === 'MISMATCH'),
    };
  });
}

const canSee = (actor: Actor) => can(actor, 'logistics.returned_goods.receive') || can(actor, 'logistics.trip.view');

/** Layar Barang Kembali (§14.1 butir 1): menunggu di Gudang, menunggu di cabang pemilik, 50 terakhir yang selesai. */
export async function returnedGoodsScreen(actor: Actor | null) {
  if (!actor || !canSee(actor)) return null;
  const rows = await rowsOf(await sources(null));
  const lastAt = (r: ReturnedGoodsRow) => (r.receipts.length ? `${r.receipts.at(-1)!.on} ${r.receipts.at(-1)!.at}` : '');
  return {
    warehouse: rows.filter((r) => r.next === 'WAREHOUSE'),
    owner: rows.filter((r) => r.next === 'OWNER'),
    done: rows.filter((r) => r.next == null).sort((a, b) => lastAt(b).localeCompare(lastAt(a))).slice(0, 50),
    canReceive: can(actor, 'logistics.returned_goods.receive'),
    from: String(await settingOn<string>('logistics.returned_goods_from', wibDate(new Date()))),
  };
}

/** Angka Beranda: barang kembali yang belum diterima (pemegang hak terima). */
export async function returnedGoodsWaiting(actor: Actor | null): Promise<number> {
  if (!actor || !can(actor, 'logistics.returned_goods.receive')) return 0;
  return countReturnedGoodsWaiting();
}

/** Hitung barang kembali belum diterima tanpa pemeriksaan hak (Dashboard Logistik). */
export async function countReturnedGoodsWaiting(): Promise<number> {
  return (await rowsOf(await sources(null))).filter((r) => r.next != null).length;
}

/**
 * Terima barang kembali (§14.1 butir 1): langkah berikutnya (Gudang, lalu cabang pemilik bila bukan Gudang), foto wajib,
 * Sesuai / Tidak sesuai (catatan wajib). Awak trip itu tidak boleh menerima barang yang ia bawa. Tidak sesuai memberi tahu
 * Kepala Gudang, Pemilik, dan GM.
 */
export async function receiveGoods(
  actor: Actor | null, input: { kind: SourceKind; sourceId: number; result?: string | null; note?: string | null }, photo: File | null,
): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.returned_goods.receive')) return fail(403, FORBIDDEN);
  const clean = cleanReceipt(input.result, input.note);
  if (!clean.ok) return fail(400, clean.error);
  const [row] = await rowsOf(await sources({ kind: input.kind, id: input.sourceId }));
  if (!row) return fail(404, 'Barang kembali tidak ditemukan.');
  if (!row.next) return fail(409, 'Barang ini sudah diterima.');
  const [crew] = await db.select({ id: tripCrew.id }).from(tripCrew)
    .where(and(eq(tripCrew.tripId, row.tripId), eq(tripCrew.employeeId, actor.personId), isNull(tripCrew.removedAt))).limit(1);
  if (crew) return fail(403, 'Awak trip ini tidak boleh menerima barang yang ia bawa sendiri.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const step = row.next;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(goodsReceipts).values({
        sourceKind: row.kind, sourceId: row.sourceId, tripId: row.tripId, step, result: clean.result, note: clean.note,
        photoFileId: upload.data.id, receivedByAccountId: actor.accountId, receivedByEmployeeId: actor.personId,
      });
      if (clean.result === 'MISMATCH') {
        await notify(tx, await accountsOf(await listEmployeesWithAnyAction(['logistics.trip.manage'])), {
          kind: 'logistics.goods_mismatch', title: `Barang kembali tidak sesuai: ${row.destination} (trip ${row.tripNumber})`,
          body: `${row.what}. ${clean.note}`, link: '/logistik/barang-kembali', entity: 'goods_receipt', entityId: row.sourceId,
        }, actor.accountId);
      }
    });
  } catch (error) {
    if (isUniqueViolation(error, 'goods_receipts_once')) return fail(409, 'Barang ini baru saja diterima orang lain.');
    throw error;
  }
  return { ok: true, data: undefined };
}

/** Foto penerimaan dan foto retur milik trip ini (pintu foto trip; pemegang hak terima boleh membukanya). */
export async function returnedGoodsPhotoIds(tripId: number): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    select photo_file_id as id from logistics.goods_receipts where trip_id = ${tripId}
    union all select photo_file_id from logistics.visit_reports where trip_id = ${tripId} and kind = 'RETURN'`);
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------- Tertunda (LOG-57, §14.1 butir 3)

const POSTPONE_KINDS = sql`('TOMORROW', 'TRIP_CLOSED', 'RESENT')`;

export type PendingRow = {
  noteId: number; kind: 'SALE' | 'TRANSFER'; number: string; origin: string; destination: string; customerId: number | null; status: 'WAITING' | 'ON_TRIP';
  times: number; firstOn: IsoDate; age: number; red: boolean; lastReason: string | null; lastTrip: { id: number; number: string } | null;
  closed: { note: string; on: IsoDate } | null;
};

/**
 * Surat jalan tertunda: masih Menunggu / Dalam perjalanan, kasir masih aktif, dan sejak tutup terakhir ada Kirim Besok
 * (atau trip ditutup dengan kunjungan sisa, atau Kirim ulang) yang tidak dibatalkan Coba lagi.
 */
async function pendingRows(noteId: number | null, executor: Executor = db) {
  return executor.execute<{
    id: number; kind: 'SALE' | 'TRANSFER'; number: string; status: 'WAITING' | 'ON_TRIP'; origin: string | null; destination: string | null;
    customer_id: number | null; times: number; first_at: string; last_reason: string | null; last_trip_id: number | null; last_trip_number: string | null;
  }>(sql`
    with closes as (select note_id, max(id) as id from logistics.delivery_note_events where kind = 'PENDING_CLOSED' group by note_id),
    since as (
      select e.note_id,
        count(*) filter (where e.kind in ${POSTPONE_KINDS}) - count(*) filter (where e.kind = 'RETRY') as times,
        min(e.at) filter (where e.kind in ${POSTPONE_KINDS}) as first_at,
        max(e.id) filter (where e.kind in ${POSTPONE_KINDS}) as last_id
      from logistics.delivery_note_events e left join closes c on c.note_id = e.note_id
      where e.id > coalesce(c.id, 0) and e.kind in ('TOMORROW', 'TRIP_CLOSED', 'RESENT', 'RETRY')
      group by e.note_id
    )
    select dn.id, dn.kind, dn.number, dn.status, coalesce(s.branch_name, p.source_branch_name) as origin,
      coalesce(c.name, p.destination_branch_name) as destination, dn.customer_id, si.times, si.first_at,
      le.reason as last_reason, lt.id as last_trip_id, lt.number as last_trip_number
    from since si
    join logistics.delivery_notes dn on dn.id = si.note_id
    left join logistics.pos_truck_sales s on dn.kind = 'SALE' and s.id = dn.doc_id
    left join logistics.pos_truck_transfers p on dn.kind = 'TRANSFER' and p.id = dn.doc_id
    left join logistics.pos_customers c on c.id = dn.customer_id
    left join logistics.delivery_note_events le on le.id = si.last_id
    left join logistics.trips lt on lt.id = le.trip_id
    where si.times > 0 and dn.status in ('WAITING', 'ON_TRIP')
      and ((dn.kind = 'SALE' and s.status = 'COMPLETED') or (dn.kind = 'TRANSFER' and p.status = 'IN_TRANSIT'))
      ${noteId != null ? sql`and dn.id = ${noteId}` : sql``}
    order by si.first_at`);
}

/** Tab Tertunda di Surat Jalan: paling lama di atas, merah lewat `logistics.pending_red_days`, 20 tutup terakhir. */
export async function pendingNotesScreen(actor: Actor | null) {
  if (!actor || !can(actor, 'logistics.delivery_note.view')) return null;
  const today = wibDate(new Date());
  const [rows, redDays, closed] = await Promise.all([
    pendingRows(null),
    settingOn<number>('logistics.pending_red_days', today),
    db.execute<{ note_id: number; number: string; reason: string | null; at: string }>(sql`
      select e.note_id, n.number, e.reason, e.at from logistics.delivery_note_events e join logistics.delivery_notes n on n.id = e.note_id
      where e.kind = 'PENDING_CLOSED' order by e.id desc limit 20`),
  ]);
  const list: PendingRow[] = rows.map((r) => {
    const firstOn = wibDate(new Date(r.first_at));
    const age = ageDays(firstOn, today);
    return {
      noteId: Number(r.id), kind: r.kind, number: r.number, origin: r.origin ?? '-', destination: r.destination ?? '-',
      customerId: r.customer_id == null ? null : Number(r.customer_id), status: r.status, times: Number(r.times), firstOn, age,
      red: pendingRed(age, Number(redDays)), lastReason: r.last_reason,
      lastTrip: r.last_trip_id && r.last_trip_number ? { id: Number(r.last_trip_id), number: r.last_trip_number } : null, closed: null,
    };
  });
  return {
    rows: list, redDays: Number(redDays), canClose: can(actor, 'logistics.delivery_note.decide'),
    closed: closed.map((c) => ({ noteId: Number(c.note_id), number: c.number, note: c.reason ?? '', on: wibDate(new Date(c.at)), at: wibClock(new Date(c.at)) })),
  };
}

/** Angka tab dan Beranda: jumlah tertunda dan yang merah. */
export async function pendingNoteCounts(actor: Actor | null): Promise<{ total: number; red: number }> {
  if (!actor || !can(actor, 'logistics.delivery_note.view')) return { total: 0, red: 0 };
  return countPendingNotes();
}

/** Hitung surat jalan tertunda (dan yang merah) tanpa pemeriksaan hak (Dashboard Logistik). */
export async function countPendingNotes(): Promise<{ total: number; red: number }> {
  const today = wibDate(new Date());
  const [rows, redDays] = await Promise.all([pendingRows(null), settingOn<number>('logistics.pending_red_days', today)]);
  return { total: rows.length, red: rows.filter((r) => pendingRed(ageDays(wibDate(new Date(r.first_at)), today), Number(redDays))).length };
}

/**
 * Tutup tertunda (LOG-57/119): Kepala Gudang / Pemilik / GM, keterangan wajib. Surat jalan tetap di antreannya; Kirim
 * Besok berikutnya membukanya lagi.
 */
export async function closePending(actor: Actor | null, noteId: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.delivery_note.decide')) return fail(403, FORBIDDEN);
  const text = reason.replace(/\s+/g, ' ').trim();
  const problem = reasonProblem(text);
  if (problem) return fail(400, problem.replace('Alasan', 'Keterangan'));
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from logistics.delivery_notes where id = ${noteId} for update`);
    const [row] = await pendingRows(noteId, tx);
    if (!row) return fail(409, 'Surat jalan ini tidak sedang tertunda.');
    await tx.insert(deliveryNoteEvents).values({ noteId, kind: 'PENDING_CLOSED', reason: text.slice(0, 500), byAccountId: actor.accountId, byEmployeeId: actor.personId });
    return { ok: true as const, data: undefined };
  });
}
