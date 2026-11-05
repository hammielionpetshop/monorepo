import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { loadReportNotes, loadReportPhotos, loadReports } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { settingOn } from '@/modules/settings';
import {
  LOAD_PHOTO_LABELS, LOAD_STATUS_LABELS, earliestNoteDate, finishProblem, noteProblem, notesProblem, photoProblem,
  type LoadPhotoKind, type LoadReportStatus, type PhotoCounts,
} from '../rules/load-reports';
import { reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, fail, isUniqueViolation, peopleNames, type Executor } from './data';

// Laporan Muat (spec LT1 §15.1, LT3a): bukti foto barang yang dimuat di cabang. Hanya bukti, tidak menahan apa pun.

const CREATE = 'logistics.load_report.create';
const VIEW = 'logistics.load_report.view';
const NOTE_TAKEN = 'Nota ini sudah dipakai laporan muat lain.';
const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);

type ReportRow = typeof loadReports.$inferSelect;
export type LoadBranch = { id: number; name: string; kasirBranchId: number };

/** Cabang HRIS aktif yang punya cabang kasir dan menyalakan Laporan Muat pada `on` (§15.1 butir 1). */
export async function loadReportBranches(on: IsoDate): Promise<LoadBranch[]> {
  const rows = await db.execute<{ id: number; name: string; kasir_branch_id: number }>(sql`
    select id, name, kasir_branch_id from hris.branches where active and kasir_branch_id is not null and merged_into_branch_id is null order by name`);
  const result: LoadBranch[] = [];
  for (const r of rows) {
    const on_ = await settingOn<string>('logistics.load_report_on', on, { branchId: Number(r.id) });
    if (on_ === 'YES') result.push({ id: Number(r.id), name: r.name, kasirBranchId: Number(r.kasir_branch_id) });
  }
  return result;
}

/** Cabang tempat pelaku boleh membuat laporan muat: cabangnya sendiri, atau semua yang menyala bagi Pemilik/GM. */
export async function creatableBranches(actor: Actor | null, on: IsoDate = wibDate(new Date())): Promise<LoadBranch[]> {
  if (!actor) return [];
  const branches = await loadReportBranches(on);
  return branches.filter((b) => can(actor, CREATE, { branchId: b.id }) && (actor.fullAccess || b.id === actor.branchId));
}

const canWork = (actor: Actor, report: Pick<ReportRow, 'branchId'>) => can(actor, CREATE, { branchId: report.branchId });

function canSee(actor: Actor, report: Pick<ReportRow, 'branchId' | 'createdByAccountId' | 'status'>): boolean {
  return can(actor, VIEW, { branchId: report.branchId }) || report.createdByAccountId === actor.accountId
    || (report.status === 'DRAFT' && canWork(actor, report));
}

export type CandidateNote = { transactionId: number; trxNumber: string; customerId: number; store: string; amount: number; trxOn: string; at: string };

/**
 * Nota kasir cabang ini yang boleh dipilih (§15.1 butir 2): berpelanggan, tidak batal, 7 hari terakhir, belum dipakai laporan
 * muat lain yang berlaku. `customerId` = hanya toko itu (menambah nota ke laporan yang sudah ada).
 */
export async function candidateNotes(actor: Actor | null, branchId: number, filter: { q?: string | null; customerId?: number | null } = {}): Promise<CandidateNote[] | null> {
  if (!actor || !can(actor, CREATE, { branchId })) return null;
  const today = wibDate(new Date());
  const branch = (await loadReportBranches(today)).find((b) => b.id === branchId);
  if (!branch) return null;
  const q = filter.q?.trim() ? `%${filter.q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const rows = await db.execute<{ id: number; trx_number: string; customer_id: number; name: string; payable_amount: number; trx_on: string; created_at: Date }>(sql`
    select s.id, s.trx_number, s.customer_id, c.name, s.payable_amount, s.trx_on::text as trx_on, s.created_at
    from logistics.pos_branch_sales s
    join logistics.pos_customers c on c.id = s.customer_id
    where s.branch_id = ${branch.kasirBranchId} and s.trx_on >= ${earliestNoteDate(today)}::date and s.status not in ('VOIDED', 'PENDING_VOID')
      and not exists (select 1 from logistics.load_report_notes n where n.transaction_id = s.id and n.released_at is null)
      ${filter.customerId ? sql`and s.customer_id = ${filter.customerId}` : sql``}
      ${q ? sql`and (s.trx_number ilike ${q} or c.name ilike ${q})` : sql``}
    order by s.created_at desc limit 100`);
  return rows.map((r) => ({
    transactionId: Number(r.id), trxNumber: r.trx_number, customerId: Number(r.customer_id), store: r.name, amount: Number(r.payable_amount),
    trxOn: r.trx_on, at: wibClock(new Date(r.created_at)),
  }));
}

/** Baca nota kasir yang dipilih dan periksa aturannya (dalam transaksi pemanggil). */
async function checkedSales(tx: Executor, transactionIds: number[], kasirBranchId: number) {
  const unique = [...new Set(transactionIds)];
  const rows = await tx.execute<{ id: number; trx_number: string; branch_id: number; customer_id: number | null; payable_amount: number; status: string; trx_on: string }>(sql`
    select id, trx_number, branch_id, customer_id, payable_amount, status, trx_on::text as trx_on from logistics.pos_branch_sales where id in (${ids(unique)})`);
  if (rows.length !== unique.length) return { ok: false as const, error: 'Ada nota yang tidak ditemukan di kasir (nota tanpa pelanggan tidak bisa dipakai).' };
  const today = wibDate(new Date());
  for (const r of rows) {
    const problem = noteProblem({ trxNumber: r.trx_number, customerId: r.customer_id, status: r.status, trxOn: r.trx_on, kasirBranchId: Number(r.branch_id) }, kasirBranchId, today);
    if (problem) return { ok: false as const, error: problem };
  }
  return { ok: true as const, rows: rows.map((r) => ({ id: Number(r.id), trxNumber: r.trx_number, customerId: Number(r.customer_id), amount: Number(r.payable_amount) })) };
}

/** Buat laporan muat dari nota kasir (§15.1 butir 2). Toko = pelanggan nota. */
export async function createLoadReport(actor: Actor | null, input: { branchId: number; transactionIds: number[] }): Promise<ServiceResult<{ id: number }>> {
  if (!actor) return fail(403, FORBIDDEN);
  const branch = (await creatableBranches(actor)).find((b) => b.id === input.branchId);
  if (!branch) return fail(403, 'Anda tidak bisa membuat laporan muat untuk cabang ini.');
  try {
    return await db.transaction(async (tx) => {
      const sales = await checkedSales(tx, input.transactionIds, branch.kasirBranchId);
      if (!sales.ok) return fail(400, sales.error);
      const problem = notesProblem(sales.rows.map((s) => s.customerId));
      if (problem) return fail(400, problem);
      const [report] = await tx.insert(loadReports).values({
        branchId: branch.id, kasirBranchId: branch.kasirBranchId, customerId: sales.rows[0].customerId,
        createdByEmployeeId: actor.personId, createdByAccountId: actor.accountId,
      }).returning({ id: loadReports.id });
      await tx.insert(loadReportNotes).values(sales.rows.map((s) => ({
        reportId: report.id, transactionId: s.id, trxNumber: s.trxNumber, amount: s.amount, addedByAccountId: actor.accountId,
      })));
      return { ok: true as const, data: { id: report.id } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'load_report_notes_once')) return fail(409, NOTE_TAKEN);
    throw error;
  }
}

/** Kunci laporan untuk diubah oleh pemegang hak buat di cabangnya. */
async function lockedReport(tx: Executor, actor: Actor, reportId: number) {
  const [report] = await tx.select().from(loadReports).where(eq(loadReports.id, reportId)).for('update').limit(1);
  if (!report || !canSee(actor, report)) return { ok: false as const, result: fail(404, 'Laporan muat tidak ditemukan.') };
  if (!canWork(actor, report)) return { ok: false as const, result: fail(403, FORBIDDEN) };
  return { ok: true as const, report };
}

const DRAFT_ONLY = 'Laporan muat ini sudah tidak dalam Proses.';

/** Tambah nota toko yang sama selama Proses. */
export async function addLoadNotes(actor: Actor | null, reportId: number, transactionIds: number[]): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  try {
    return await db.transaction(async (tx) => {
      const locked = await lockedReport(tx, actor, reportId);
      if (!locked.ok) return locked.result;
      const { report } = locked;
      if (report.status !== 'DRAFT') return fail(409, DRAFT_ONLY);
      const sales = await checkedSales(tx, transactionIds, report.kasirBranchId);
      if (!sales.ok) return fail(400, sales.error);
      const active = await tx.select({ id: loadReportNotes.id }).from(loadReportNotes).where(and(eq(loadReportNotes.reportId, reportId), isNull(loadReportNotes.releasedAt)));
      const problem = notesProblem(sales.rows.map((s) => s.customerId), active.length)
        ?? (sales.rows.some((s) => s.customerId !== report.customerId) ? 'Semua nota di satu laporan muat harus dari toko yang sama.' : null);
      if (problem) return fail(400, problem);
      await tx.insert(loadReportNotes).values(sales.rows.map((s) => ({
        reportId, transactionId: s.id, trxNumber: s.trxNumber, amount: s.amount, addedByAccountId: actor.accountId,
      })));
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'load_report_notes_once')) return fail(409, NOTE_TAKEN);
    throw error;
  }
}

/** Lepas satu nota selama Proses; nota terakhir tidak bisa dilepas (batalkan laporannya). */
export async function releaseLoadNote(actor: Actor | null, reportId: number, noteId: number): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const locked = await lockedReport(tx, actor, reportId);
    if (!locked.ok) return locked.result;
    if (locked.report.status !== 'DRAFT') return fail(409, DRAFT_ONLY);
    const active = await tx.select({ id: loadReportNotes.id }).from(loadReportNotes).where(and(eq(loadReportNotes.reportId, reportId), isNull(loadReportNotes.releasedAt)));
    if (!active.some((n) => n.id === noteId)) return fail(404, 'Nota tidak ada di laporan ini.');
    if (active.length <= 1) return fail(400, 'Nota terakhir tidak bisa dilepas. Batalkan laporannya bila salah.');
    await tx.update(loadReportNotes).set({ releasedAt: new Date(), releasedByAccountId: actor.accountId }).where(eq(loadReportNotes.id, noteId));
    return { ok: true as const, data: undefined };
  });
}

async function photoCounts(tx: Executor, reportId: number): Promise<PhotoCounts> {
  const rows = await tx.select({ kind: loadReportPhotos.kind }).from(loadReportPhotos).where(and(eq(loadReportPhotos.reportId, reportId), isNull(loadReportPhotos.removedAt)));
  return { NOTE: rows.filter((r) => r.kind === 'NOTE').length, GOODS: rows.filter((r) => r.kind === 'GOODS').length };
}

/** Tambah foto (kamera langsung): selama Proses, atau susulan sesudah Selesai (§15.1 butir 3, 4). */
export async function addLoadPhoto(actor: Actor | null, reportId: number, kind: LoadPhotoKind, photo: File | null): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const [peek] = await db.select().from(loadReports).where(eq(loadReports.id, reportId)).limit(1);
  if (!peek || !canSee(actor, peek)) return fail(404, 'Laporan muat tidak ditemukan.');
  if (!canWork(actor, peek)) return fail(403, FORBIDDEN);
  const early = photoProblem(peek.status as LoadReportStatus, kind, await photoCounts(db, reportId));
  if (early) return fail(409, early);
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  return db.transaction(async (tx) => {
    const locked = await lockedReport(tx, actor, reportId);
    if (!locked.ok) return locked.result;
    const status = locked.report.status as LoadReportStatus;
    const problem = photoProblem(status, kind, await photoCounts(tx, reportId));
    if (problem) return fail(409, problem);
    await tx.insert(loadReportPhotos).values({
      reportId, kind, fileId: upload.data.id, late: status === 'DONE', takenByEmployeeId: actor.personId, takenByAccountId: actor.accountId,
    });
    return { ok: true as const, data: undefined };
  });
}

/** Buang foto selama Proses (tercatat, tidak dihapus). Foto barang tidak bisa tinggal tanpa foto nota. */
export async function removeLoadPhoto(actor: Actor | null, reportId: number, photoId: number): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const locked = await lockedReport(tx, actor, reportId);
    if (!locked.ok) return locked.result;
    if (locked.report.status !== 'DRAFT') return fail(409, 'Foto laporan yang sudah Selesai terkunci.');
    const [photo] = await tx.select().from(loadReportPhotos)
      .where(and(eq(loadReportPhotos.id, photoId), eq(loadReportPhotos.reportId, reportId), isNull(loadReportPhotos.removedAt))).limit(1);
    if (!photo) return fail(404, 'Foto tidak ditemukan.');
    const counts = await photoCounts(tx, reportId);
    if (photo.kind === 'NOTE' && counts.NOTE === 1 && counts.GOODS > 0) return fail(400, 'Buang foto barang dulu, atau tambah foto nota lain sebelum membuang yang ini.');
    await tx.update(loadReportPhotos).set({ removedAt: new Date(), removedByAccountId: actor.accountId }).where(eq(loadReportPhotos.id, photoId));
    return { ok: true as const, data: undefined };
  });
}

/** Selesai: laporan terkunci (§15.1 butir 4). */
export async function finishLoadReport(actor: Actor | null, reportId: number): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const locked = await lockedReport(tx, actor, reportId);
    if (!locked.ok) return locked.result;
    const notes = await tx.select({ id: loadReportNotes.id }).from(loadReportNotes).where(and(eq(loadReportNotes.reportId, reportId), isNull(loadReportNotes.releasedAt)));
    const problem = finishProblem(locked.report.status as LoadReportStatus, await photoCounts(tx, reportId), notes.length);
    if (problem) return fail(409, problem);
    await tx.update(loadReports).set({ status: 'DONE', doneAt: new Date(), doneByAccountId: actor.accountId }).where(eq(loadReports.id, reportId));
    return { ok: true as const, data: undefined };
  });
}

/** Batal selama Proses, alasan wajib; nota dilepas (§15.1 butir 5). */
export async function cancelLoadReport(actor: Actor | null, reportId: number, reason: string): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const text = reason.trim();
  const reasonError = reasonProblem(text);
  if (reasonError) return fail(400, reasonError);
  return db.transaction(async (tx) => {
    const locked = await lockedReport(tx, actor, reportId);
    if (!locked.ok) return locked.result;
    if (locked.report.status !== 'DRAFT') return fail(409, 'Hanya laporan Proses yang bisa dibatalkan.');
    const now = new Date();
    await tx.update(loadReportNotes).set({ releasedAt: now, releasedByAccountId: actor.accountId })
      .where(and(eq(loadReportNotes.reportId, reportId), isNull(loadReportNotes.releasedAt)));
    await tx.update(loadReports).set({ status: 'CANCELLED', cancelledAt: now, cancelledByAccountId: actor.accountId, cancelReason: text.slice(0, 500) })
      .where(eq(loadReports.id, reportId));
    return { ok: true as const, data: undefined };
  });
}

export type LoadReportTab = 'DRAFT' | 'DONE' | 'CANCELLED';

export type LoadReportListRow = {
  id: number; status: LoadReportStatus; statusLabel: string; store: string; branch: string; notes: string[]; by: string; on: string; at: string;
  doneAt: string | null; photos: PhotoCounts;
};

/** Syarat lihat di SQL, sama dengan `canSee`. */
function visibleWhere(actor: Actor) {
  if (actor.fullAccess || actor.grants.get(VIEW) === 'ALL') return sql`true`;
  const parts = [sql`r.created_by_account_id = ${actor.accountId}`];
  if (actor.grants.get(VIEW) && actor.branchId != null) parts.push(sql`r.branch_id = ${actor.branchId}`);
  if (actor.grants.get(CREATE) === 'ALL') parts.push(sql`r.status = 'DRAFT'`);
  else if (actor.grants.get(CREATE) && actor.branchId != null) parts.push(sql`(r.status = 'DRAFT' and r.branch_id = ${actor.branchId})`);
  return sql`(${sql.join(parts, sql` or `)})`;
}

/** Halaman Laporan Muat (§15.1 butir 8): tab, rentang tanggal buat (WIB), cari nomor nota / toko / pembuat. */
export async function loadReportList(actor: Actor | null, filter: { tab: LoadReportTab; from: IsoDate; to: IsoDate; q?: string | null }) {
  if (!actor) return null;
  const today = wibDate(new Date());
  const branches = await creatableBranches(actor, today);
  const mayView = actor.fullAccess || actor.grants.has(VIEW) || actor.grants.has(CREATE);
  if (!mayView) return null;
  const q = filter.q?.trim() ? `%${filter.q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const rows = await db.execute<{
    id: number; status: string; customer: string | null; branch: string | null; created_by_employee_id: number | null; created_at: Date; done_at: Date | null;
    notes: string[] | null; note_photos: number; goods_photos: number;
  }>(sql`
    select r.id, r.status, c.name as customer, b.name as branch, r.created_by_employee_id, r.created_at, r.done_at,
      (select array_agg(n.trx_number order by n.id) from logistics.load_report_notes n where n.report_id = r.id and (n.released_at is null or r.status = 'CANCELLED')) as notes,
      (select count(*)::int from logistics.load_report_photos p where p.report_id = r.id and p.removed_at is null and p.kind = 'NOTE') as note_photos,
      (select count(*)::int from logistics.load_report_photos p where p.report_id = r.id and p.removed_at is null and p.kind = 'GOODS') as goods_photos
    from logistics.load_reports r
    left join logistics.pos_customers c on c.id = r.customer_id
    left join hris.branches b on b.id = r.branch_id
    left join hris.employees e on e.id = r.created_by_employee_id
    where r.status = ${filter.tab} and ${visibleWhere(actor)}
      and (r.created_at at time zone 'Asia/Jakarta')::date between ${filter.from}::date and ${filter.to}::date
      ${q ? sql`and (c.name ilike ${q} or e.name ilike ${q} or exists (select 1 from logistics.load_report_notes n where n.report_id = r.id and n.trx_number ilike ${q}))` : sql``}
    order by r.created_at desc limit 200`);
  const people = await peopleNames();
  const list: LoadReportListRow[] = rows.map((r) => {
    const created = new Date(r.created_at);
    return {
      id: Number(r.id), status: r.status as LoadReportStatus, statusLabel: LOAD_STATUS_LABELS[r.status as LoadReportStatus],
      store: r.customer ?? '-', branch: r.branch ?? '-', notes: r.notes ?? [],
      by: (r.created_by_employee_id ? people.get(Number(r.created_by_employee_id)) : null) ?? '-', on: wibDate(created), at: wibClock(created),
      doneAt: r.done_at ? `${wibDate(new Date(r.done_at))} ${wibClock(new Date(r.done_at))}` : null,
      photos: { NOTE: Number(r.note_photos), GOODS: Number(r.goods_photos) },
    };
  });
  return { rows: list, branches, today };
}

export type LoadPhotoView = { id: number; kind: LoadPhotoKind; label: string; url: string; late: boolean; by: string; at: string; removed: string | null };

/** Rincian satu laporan muat (§15.1 butir 8). */
export async function loadReportDetail(actor: Actor | null, reportId: number) {
  if (!actor) return null;
  const [report] = await db.select().from(loadReports).where(eq(loadReports.id, reportId)).limit(1);
  if (!report || !canSee(actor, report)) return null;
  const [notes, photos, customerRows, branchRows, people, accountRows] = await Promise.all([
    db.select().from(loadReportNotes).where(eq(loadReportNotes.reportId, reportId)).orderBy(asc(loadReportNotes.id)),
    db.select().from(loadReportPhotos).where(eq(loadReportPhotos.reportId, reportId)).orderBy(asc(loadReportPhotos.id)),
    db.execute<{ name: string; phone: string | null; address: string | null }>(sql`select name, phone, address from logistics.pos_customers where id = ${report.customerId}`),
    db.execute<{ name: string }>(sql`select name from hris.branches where id = ${report.branchId}`),
    peopleNames(),
    db.execute<{ account_id: number; name: string }>(sql`
      select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
      where l.app_code = 'hris' and l.account_id in (${ids([report.doneByAccountId, report.cancelledByAccountId].filter((v): v is number => v != null))})`),
  ]);
  const accountName = new Map(accountRows.map((a) => [Number(a.account_id), a.name]));
  const stamp = (at: Date | null) => (at ? `${wibDate(at)} ${wibClock(at)}` : null);
  const sales = notes.length
    ? await db.execute<{ id: number; payable_amount: number; status: string }>(sql`
      select id, payable_amount, status from logistics.pos_branch_sales where id in (${ids(notes.map((n) => n.transactionId))})`)
    : [];
  const sale = new Map(sales.map((s) => [Number(s.id), s]));
  const status = report.status as LoadReportStatus;
  const work = canWork(actor, report);
  const counts: PhotoCounts = {
    NOTE: photos.filter((p) => p.kind === 'NOTE' && !p.removedAt).length, GOODS: photos.filter((p) => p.kind === 'GOODS' && !p.removedAt).length,
  };
  const photoView = (p: typeof photos[number]): LoadPhotoView => ({
    id: p.id, kind: p.kind as LoadPhotoKind, label: LOAD_PHOTO_LABELS[p.kind as LoadPhotoKind], url: `/api/logistics/load-photo?photo=${p.id}`, late: p.late,
    by: (p.takenByEmployeeId ? people.get(p.takenByEmployeeId) : null) ?? '-', at: stamp(p.takenAt)!, removed: stamp(p.removedAt),
  });
  return {
    id: report.id, status, statusLabel: LOAD_STATUS_LABELS[status], branchId: report.branchId, branch: branchRows[0]?.name ?? '-',
    customerId: report.customerId, store: customerRows[0]?.name ?? `Pelanggan #${report.customerId}`, phone: customerRows[0]?.phone ?? null,
    address: customerRows[0]?.address ?? null,
    by: (report.createdByEmployeeId ? people.get(report.createdByEmployeeId) : null) ?? '-', createdAt: stamp(report.createdAt)!,
    doneAt: stamp(report.doneAt), doneBy: report.doneByAccountId ? accountName.get(report.doneByAccountId) ?? '-' : null,
    cancelledAt: stamp(report.cancelledAt), cancelledBy: report.cancelledByAccountId ? accountName.get(report.cancelledByAccountId) ?? '-' : null,
    cancelReason: report.cancelReason,
    notes: notes.filter((n) => !n.releasedAt || status === 'CANCELLED').map((n) => {
      const now = sale.get(n.transactionId);
      return {
        id: n.id, trxNumber: n.trxNumber, amount: n.amount, kasirAmount: now ? Number(now.payable_amount) : null,
        voided: now ? now.status === 'VOIDED' || now.status === 'PENDING_VOID' : false,
      };
    }),
    photos: photos.filter((p) => !p.removedAt).map(photoView),
    removedPhotos: photos.filter((p) => p.removedAt).map(photoView),
    counts,
    canWork: work && status !== 'CANCELLED',
    canEditDraft: work && status === 'DRAFT',
  };
}

/** Pintu foto laporan muat: hanya yang boleh melihat laporannya. */
export async function openLoadPhoto(actor: Actor | null, photoId: number): Promise<string | null> {
  if (!actor) return null;
  const [row] = await db.select({ fileId: loadReportPhotos.fileId, reportId: loadReportPhotos.reportId }).from(loadReportPhotos).where(eq(loadReportPhotos.id, photoId)).limit(1);
  if (!row) return null;
  const [report] = await db.select().from(loadReports).where(inArray(loadReports.id, [row.reportId])).limit(1);
  return report && canSee(actor, report) ? row.fileId : null;
}
