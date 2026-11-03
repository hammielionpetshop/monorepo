import { eq } from 'drizzle-orm';
import { requestAttachments, requestEvents, requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import {
  can, listEmployeesWithAnyAction, loadActor, recordAudit, requestTypeAllowedFor, type Actor, type ServiceResult, type Target, type Tx,
} from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { getEmployeeBasic, loadTarget } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { checkReason } from '@/modules/settings';
import { STATUS_LABELS, canTransition, isOpen, isOwnRequest, requestNumber, type RequestStatus } from '../rules/status';
import { REQUEST_TYPES, isRequestTypeKey, type RequestTypeDefinition, type RequestTypeKey } from '../rules/types';
import type { RequestHandler } from './handler';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

type RequestRow = typeof requests.$inferSelect;

const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string; constraint?: string };
  return pg?.code === '23505' && (pg.constraint_name ?? pg.constraint) === constraint;
}

export function typeOf(row: Pick<RequestRow, 'typeKey'>): RequestTypeDefinition | null {
  return isRequestTypeKey(row.typeKey) ? REQUEST_TYPES[row.typeKey] : null;
}

/** Peran pelaku atas satu pengajuan. Target = penempatan orang yang diajukan hari ini. */
export function rolesOn(actor: Actor | null, row: RequestRow, target: Target | null) {
  const type = typeOf(row);
  if (!actor || !type) {
    return { own: false, decider: false, reviewer: false, viewer: false, canView: false, canDecide: false, canApprove: false, canReview: false, canSeeAttachments: false };
  }
  const own = actor.personId === row.subjectEmployeeId || actor.personId === row.submittedByEmployeeId
    || actor.accountId === row.submittedByAccountId;
  const scope = target ?? { personId: row.subjectEmployeeId };
  // `can()` sudah menolak tindakan selfForbidden atas diri sendiri; isOwnRequest menutup sisanya (KAR-72 butir 2).
  const approver = can(actor, type.decideAction, scope);
  // Pemeriksa (tahap Diperiksa, kasbon L5) hanya memeriksa: tidak menyetujui dan tidak menolak (DRV-124).
  const reviewer = !!type.reviewAction && can(actor, type.reviewAction, scope);
  const decider = approver || reviewer;
  const viewer = type.extraViewers.some((action) => can(actor, action, scope));
  const notOwn = !isOwnRequest({
    actorAccountId: actor.accountId, actorPersonId: actor.personId, submittedByAccountId: row.submittedByAccountId,
    submittedByEmployeeId: row.submittedByEmployeeId, subjectEmployeeId: row.subjectEmployeeId,
  });
  const canApprove = approver && isOpen(row.status) && notOwn;
  const canReview = reviewer && !approver && row.status === 'PENDING' && notOwn;
  return {
    own, decider, reviewer, viewer,
    canView: own || decider || viewer,
    /** Ada yang bisa dikerjakan pelaku (menyetujui/menolak, atau memeriksa): dipakai daftar dan angka Persetujuan. */
    canDecide: canApprove || canReview,
    canApprove,
    canReview,
    // Lampiran tertutup: pengaju, penyetuju, dan Pemilik/GM saja (PRI-23).
    canSeeAttachments: type.confidential ? own || decider || actor.fullAccess : own || decider || viewer,
  };
}

/** Akun yang boleh memutuskan pengajuan ini; kosong → Pemilik/GM (PRI-43 butir 4). Pengaju tidak ikut. */
async function decidersOf(type: RequestTypeDefinition, row: Pick<RequestRow,
  'subjectEmployeeId' | 'submittedByAccountId' | 'submittedByEmployeeId'>, target: Target | null, action = type.decideAction): Promise<number[]> {
  const pick = async (employeeIds: number[]) => {
    const accounts = await activeHrisAccounts(employeeIds);
    const result: number[] = [];
    for (const [employeeId, accountId] of accounts) {
      const actor = await loadActor(accountId, employeeId);
      const scope = target ?? { personId: row.subjectEmployeeId };
      if (!can(actor, action, scope)) continue;
      // Pemilik/GM berhak penuh tetapi bukan pemeriksa: mereka penyetuju (tahap Diperiksa milik pemegang reviewAction).
      if (action !== type.decideAction && actor.fullAccess) continue;
      if (isOwnRequest({
        actorAccountId: accountId, actorPersonId: employeeId, submittedByAccountId: row.submittedByAccountId,
        submittedByEmployeeId: row.submittedByEmployeeId, subjectEmployeeId: row.subjectEmployeeId,
      })) continue;
      result.push(accountId);
    }
    return result;
  };
  const deciders = await pick(await listEmployeesWithAnyAction([action]));
  if (deciders.length || action !== type.decideAction) return deciders;
  return pick(await listEmployeesWithAnyAction([]));
}

async function addEvent(tx: Tx, input: {
  requestId: number; from: RequestStatus | null; to: RequestStatus; actor: Actor; reason?: string | null;
}) {
  await tx.insert(requestEvents).values({
    requestId: input.requestId, fromStatus: input.from, toStatus: input.to,
    actorAccountId: input.actor.accountId, actorEmployeeId: input.actor.personId, reason: input.reason ?? null,
  });
}

export type SubmitInput = {
  fields: Record<string, unknown>;
  attachmentIds: string[];
  resubmittedFromId?: number | null;
};

/** BER-L06 Kirim: periksa hak + isian + lampiran + kembar, lalu simpan dan beri tahu penyetuju dalam satu transaksi. */
export async function submitRequest(actor: Actor | null, typeKey: string, handler: RequestHandler, input: SubmitInput)
  : Promise<ServiceResult<{ id: number; message: string }>> {
  if (!isRequestTypeKey(typeKey)) return fail(400, 'Jenis pengajuan tidak dikenal.');
  const key: RequestTypeKey = typeKey;
  const type: RequestTypeDefinition = REQUEST_TYPES[key];
  if (!actor || !can(actor, type.requestAction, { personId: actor.personId }) || !requestTypeAllowedFor(actor, key)) {
    return fail(403, `Anda tidak berhak mengajukan ${type.label.toLowerCase()}.`);
  }
  const me = await getEmployeeBasic(actor.personId);
  if (!me) return fail(404, 'Data karyawan Anda tidak ditemukan.');

  try {
    const created = await db.transaction(async (tx) => {
      const prepared = await handler.prepare(tx, actor, input.fields);
      if (!prepared.ok) return prepared;
      const { subjectEmployeeId, summary, dedupeKey, requiredAttachment } = prepared.data;
      const attachmentIds = [...new Set(input.attachmentIds)];
      const owned = await filesUploadedBy(tx, actor.accountId, attachmentIds);
      if (owned.length !== attachmentIds.length) return fail(400, 'Lampiran tidak ditemukan. Unggah ulang fotonya.');
      if (requiredAttachment && !owned.length) return fail(400, `${requiredAttachment} wajib dilampirkan.`);
      let resubmittedFromId: number | null = null;
      if (input.resubmittedFromId) {
        const [old] = await tx.select().from(requests).where(eq(requests.id, input.resubmittedFromId));
        if (!old || old.typeKey !== key || old.status !== 'REJECTED' || old.submittedByAccountId !== actor.accountId) {
          return fail(400, 'Pengajuan lama tidak bisa diajukan ulang.');
        }
        resubmittedFromId = old.id;
      }
      const subjectTarget = subjectEmployeeId === actor.personId ? me.target : await loadTarget(subjectEmployeeId);
      const [row] = await tx.insert(requests).values({
        typeKey: key, subjectEmployeeId, submittedByAccountId: actor.accountId, submittedByEmployeeId: actor.personId,
        status: 'PENDING', summary, branchId: subjectTarget?.branchId ?? null, dedupeKey, resubmittedFromId,
      }).returning();
      await prepared.data.save(tx, row.id);
      if (owned.length) {
        await tx.insert(requestAttachments).values(owned.map((fileId) => ({
          requestId: row.id, fileId, label: requiredAttachment ?? type.attachments.label,
        })));
      }
      await addEvent(tx, { requestId: row.id, from: null, to: 'PENDING', actor });
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'request', entityId: row.id, action: 'request.submit',
        after: { typeKey: key, subjectEmployeeId, summary, attachments: owned.length, resubmittedFromId },
      });
      // Jenis bertahap periksa (kasbon): pemeriksa diberi tahu lebih dulu; tidak ada pemeriksa lain → penyetuju (DRV-124, K3).
      const reviewers = type.reviewAction ? await decidersOf(type, row, subjectTarget, type.reviewAction) : [];
      const recipients = reviewers.length ? reviewers : await decidersOf(type, row, subjectTarget);
      await notify(tx, recipients, {
        kind: 'request.submitted',
        title: `Pengajuan baru: ${type.label} — ${me.name}`,
        body: summary,
        link: `/persetujuan/${row.id}`,
        entity: 'request', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: { id: row.id, message: type.submittedMessage } };
    });
    return created;
  } catch (error) {
    if (isUniqueViolation(error, 'requests_one_open_per_key')) {
      return fail(409, `Masih ada pengajuan ${type.label.toLowerCase()} yang menunggu. Tunggu keputusannya atau batalkan dulu.`);
    }
    throw error;
  }
}

async function lockRequest(tx: Tx, id: number): Promise<RequestRow | null> {
  const [row] = await tx.select().from(requests).where(eq(requests.id, id)).for('update');
  return row ?? null;
}

/** "Sudah diputuskan Nadia pukul 10.42: disetujui." (BER-L21, dua penyetuju bersamaan). */
async function alreadyDecided(row: RequestRow): Promise<Fail> {
  const who = row.decidedByEmployeeId ? (await getEmployeeBasic(row.decidedByEmployeeId))?.name : null;
  const at = row.decidedAt ? ` pukul ${timeFormat.format(row.decidedAt)}` : '';
  const status = STATUS_LABELS[row.status].toLowerCase();
  return fail(409, who ? `Sudah diputuskan ${who}${at}: ${status}.` : `Pengajuan ini sudah ${status}. Muat ulang halaman.`);
}

async function moveStatus(tx: Tx, row: RequestRow, to: RequestStatus, actor: Actor, reason: string | null) {
  if (!canTransition(row.status, to)) throw new Error(`Perpindahan ${row.status} → ${to} tidak sah`);
  const decided = to === 'APPROVED' || to === 'REJECTED' || to === 'REVOKED';
  const [updated] = await tx.update(requests).set({
    status: to,
    version: row.version + 1,
    ...(decided ? {
      decidedByAccountId: actor.accountId, decidedByEmployeeId: actor.personId, decidedAt: new Date(), decisionReason: reason,
    } : {}),
  }).where(eq(requests.id, row.id)).returning();
  await addEvent(tx, { requestId: row.id, from: row.status, to, actor, reason });
  await recordAudit(tx, {
    actorAccountId: actor.accountId, entity: 'request', entityId: row.id, action: `request.${to.toLowerCase()}`,
    before: { status: row.status }, after: { status: to }, reason,
  });
  return updated;
}

/** Pengaju, atau orang yang diajukan bila pengajuannya diisikan atas namanya (KEH-148). */
function isCanceller(actor: Actor, row: RequestRow): boolean {
  return row.submittedByAccountId === actor.accountId || row.subjectEmployeeId === actor.personId;
}

/** Sebab pembatalan sesudah disetujui ditolak, atau null bila boleh (KEH-40; spec L3f §9 butir 3). */
export async function approvedCancelBlock(row: RequestRow, handler: RequestHandler | undefined): Promise<string | null> {
  const type = typeOf(row);
  if (row.status !== 'APPROVED' || !type?.cancelAfterApproval || !handler?.cancelApprovedBlock) {
    return 'Pengajuan yang sudah disetujui tidak bisa dibatalkan.';
  }
  return handler.cancelApprovedBlock(row.id);
}

/**
 * BER-L07 Batalkan (alasan wajib): selama menunggu, atau sesudah disetujui untuk jenis yang mengizinkannya.
 * Pembatalan sesudah disetujui memberi tahu penyetujunya.
 */
export async function cancelRequest(
  actor: Actor | null, id: number, expectedVersion: number, reasonInput: unknown, handlers: Record<string, RequestHandler> = {},
): Promise<ServiceResult<{ id: number }>> {
  if (!actor) return fail(403, 'Anda tidak berhak membatalkan pengajuan ini.');
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    const row = await lockRequest(tx, id);
    if (!row) return fail(404, 'Pengajuan tidak ditemukan.');
    if (!isCanceller(actor, row) || !requestTypeAllowedFor(actor, row.typeKey)) return fail(403, 'Hanya pengaju yang bisa membatalkan pengajuan ini.');
    if (row.version !== expectedVersion) return alreadyDecided(row);
    const handler = handlers[row.typeKey];
    if (row.status === 'APPROVED') {
      const blocked = await approvedCancelBlock(row, handler);
      if (blocked) return fail(409, blocked);
    } else if (!isOpen(row.status)) {
      return fail(409, `Pengajuan ini sudah ${STATUS_LABELS[row.status].toLowerCase()}.`);
    }
    await moveStatus(tx, row, 'CANCELLED', actor, reason.reason);
    await handler?.close?.(tx, actor.accountId, row.id, reason.reason);
    if (row.status === 'APPROVED' && row.decidedByAccountId) {
      const type = typeOf(row);
      const me = await getEmployeeBasic(actor.personId);
      await notify(tx, [row.decidedByAccountId], {
        kind: 'request.cancelled',
        title: `${type?.label ?? 'Pengajuan'} yang Anda setujui dibatalkan${me ? ` oleh ${me.name}` : ''}`,
        body: `Alasan: ${reason.reason}`,
        link: `/persetujuan/${row.id}`, entity: 'request', entityId: row.id,
      }, actor.accountId);
    }
    return { ok: true as const, data: { id } };
  });
}

/** Penyetuju boleh mencabut pengajuan yang sudah disetujui ini (KEH-148): jenisnya bisa dicabut, bukan miliknya. */
export function canRevoke(actor: Actor | null, row: RequestRow, target: Target | null): boolean {
  const type = typeOf(row);
  if (!actor || !type?.revocable || row.status !== 'APPROVED') return false;
  if (!can(actor, type.decideAction, target ?? { personId: row.subjectEmployeeId })) return false;
  return !isOwnRequest({
    actorAccountId: actor.accountId, actorPersonId: actor.personId, submittedByAccountId: row.submittedByAccountId,
    submittedByEmployeeId: row.submittedByEmployeeId, subjectEmployeeId: row.subjectEmployeeId,
  });
}

/** Cabut persetujuan (alasan wajib, KEH-40, 148). Akibatnya dibereskan `close` milik jenisnya. */
export async function revokeRequest(
  actor: Actor | null, id: number, expectedVersion: number, reasonInput: unknown, handlers: Record<string, RequestHandler>,
): Promise<ServiceResult<{ id: number; message: string }>> {
  if (!actor) return fail(403, 'Anda tidak berhak mencabut pengajuan ini.');
  const reason = await checkReason(reasonInput, 'Alasan mencabut');
  if (!reason.ok) return fail(400, reason.error);
  const [peek] = await db.select().from(requests).where(eq(requests.id, id));
  if (!peek) return fail(404, 'Pengajuan tidak ditemukan.');
  const target = await loadTarget(peek.subjectEmployeeId);
  return db.transaction(async (tx) => {
    const row = await lockRequest(tx, id);
    if (!row) return fail(404, 'Pengajuan tidak ditemukan.');
    if (row.version !== expectedVersion) return alreadyDecided(row);
    if (row.status !== 'APPROVED') return fail(409, `Pengajuan ini sudah ${STATUS_LABELS[row.status].toLowerCase()}.`);
    if (!canRevoke(actor, row, target)) return fail(403, 'Anda tidak berhak mencabut pengajuan ini.');
    const blocked = await handlers[row.typeKey]?.revokeBlock?.(tx, row.id);
    if (blocked) return fail(409, blocked);
    await moveStatus(tx, row, 'REVOKED', actor, reason.reason);
    await handlers[row.typeKey]?.close?.(tx, actor.accountId, row.id, reason.reason);
    const recipients = [row.submittedByAccountId];
    const subjectAccount = (await activeHrisAccounts([row.subjectEmployeeId])).get(row.subjectEmployeeId);
    if (subjectAccount && subjectAccount !== row.submittedByAccountId) recipients.push(subjectAccount);
    const type = typeOf(row);
    await notify(tx, recipients, {
      kind: 'request.revoked',
      title: `Persetujuan ${type?.label.toLowerCase() ?? 'pengajuan'} dicabut`,
      body: `Alasan: ${reason.reason}`,
      link: `/pengajuan/${row.id}`, entity: 'request', entityId: row.id,
    }, actor.accountId);
    return { ok: true as const, data: { id, message: `${requestNumber(id)} dicabut. Orangnya diberi tahu alasannya.` } };
  });
}

/** Lampiran susulan dari modul jenisnya (mis. surat dokter menyusul), di transaksinya sendiri. Hanya tambah. */
export async function attachToRequest(tx: Tx, requestId: number, fileId: string, label: string): Promise<void> {
  await tx.insert(requestAttachments).values({ requestId, fileId, label });
}

/**
 * Tahap Diperiksa (PRI-37, kasbon DRV-124): pemeriksa menyimpan pemeriksaannya lewat `review` milik jenisnya, status
 * Menunggu → Diperiksa, penyetuju diberi tahu. Pemeriksa tidak memeriksa pengajuannya sendiri.
 */
export async function reviewRequest(actor: Actor | null, id: number, handlers: Record<string, RequestHandler>, input: { expectedVersion: number; fields?: Record<string, unknown> })
  : Promise<ServiceResult<{ id: number; message: string }>> {
  if (!actor) return fail(403, 'Anda tidak berhak memeriksa pengajuan ini.');
  const [peek] = await db.select().from(requests).where(eq(requests.id, id));
  if (!peek) return fail(404, 'Pengajuan tidak ditemukan.');
  const target = await loadTarget(peek.subjectEmployeeId);
  const handler = handlers[peek.typeKey];
  if (!handler?.review) return fail(400, 'Jenis pengajuan ini tidak punya tahap periksa.');
  try {
    return await db.transaction(async (tx) => {
      const row = await lockRequest(tx, id);
      if (!row) return fail(404, 'Pengajuan tidak ditemukan.');
      const type = typeOf(row);
      if (!type?.reviewAction) return fail(400, 'Jenis pengajuan ini tidak punya tahap periksa.');
      const roles = rolesOn(actor, row, target);
      if (roles.own && roles.reviewer) return fail(403, 'Pengajuan milik sendiri diperiksa pemeriksa lain.');
      if (row.version !== input.expectedVersion || row.status !== 'PENDING') return alreadyDecided(row);
      if (!roles.canReview) return fail(403, 'Anda tidak berhak memeriksa pengajuan ini.');
      const reviewed = await handler.review!(tx, actor.accountId, row.id, input.fields ?? {});
      if (!reviewed.ok) throw new DecisionAborted(reviewed);
      await moveStatus(tx, row, 'REVIEWED', actor, null);
      const me = await getEmployeeBasic(actor.personId);
      await notify(tx, await decidersOf(type, row, target), {
        kind: 'request.reviewed',
        title: `${type.label} sudah diperiksa${me ? ` oleh ${me.name}` : ''}`,
        body: `${row.summary}. Menunggu keputusan Anda.`,
        link: `/persetujuan/${row.id}`, entity: 'request', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: { id, message: `${requestNumber(id)} sudah diperiksa. ${reviewed.effect}` } };
    });
  } catch (error) {
    if (error instanceof DecisionAborted) return error.result;
    throw error;
  }
}

export type DecideInput = { decision: 'APPROVE' | 'REJECT'; expectedVersion: number; reason?: unknown; fields?: Record<string, unknown> };

/** BER-L21 Setujui / Tolak. Satu penyetuju cukup; versi basi = sudah diputuskan orang lain. */
export async function decideRequest(actor: Actor | null, id: number, handlers: Record<string, RequestHandler>, input: DecideInput)
  : Promise<ServiceResult<{ id: number; message: string }>> {
  if (!actor) return fail(403, 'Anda tidak berhak memutuskan pengajuan ini.');
  let reason: string | null = null;
  if (input.decision === 'REJECT') {
    const checked = await checkReason(input.reason, 'Alasan menolak');
    if (!checked.ok) return fail(400, checked.error);
    reason = checked.reason;
  }
  const [peek] = await db.select().from(requests).where(eq(requests.id, id));
  if (!peek) return fail(404, 'Pengajuan tidak ditemukan.');
  const rejectMin = typeOf(peek)?.rejectReasonMin;
  if (reason != null && rejectMin && reason.length < rejectMin) return fail(400, `Alasan menolak paling sedikit ${rejectMin} huruf.`);
  const target = await loadTarget(peek.subjectEmployeeId);

  const handler = handlers[peek.typeKey];
  if (!handler) return fail(400, 'Jenis pengajuan tidak dikenal.');

  try {
    return await db.transaction(async (tx) => {
      const row = await lockRequest(tx, id);
      if (!row) return fail(404, 'Pengajuan tidak ditemukan.');
      const type = typeOf(row);
      if (!type) return fail(400, 'Jenis pengajuan tidak dikenal.');
      const roles = rolesOn(actor, row, target);
      if (!roles.decider && !roles.own) return fail(403, 'Anda tidak berhak memutuskan pengajuan ini.');
      if (row.version !== input.expectedVersion || !isOpen(row.status)) return alreadyDecided(row);
      if (roles.own) return fail(403, 'Pengajuan milik sendiri diputuskan penyetuju lain.');
      if (!roles.canApprove) {
        return fail(403, roles.reviewer ? 'Pemeriksa tidak menyetujui dan tidak menolak; tekan Sudah diperiksa.' : 'Anda tidak berhak memutuskan pengajuan ini.');
      }
      const noteMin = type.approveNoteMin;
      if (input.decision === 'APPROVE' && noteMin && String(input.fields?.note ?? '').trim().length < noteMin) {
        return fail(400, `Catatan paling sedikit ${noteMin} huruf.`);
      }

      const recipients = [row.submittedByAccountId];
      const subjectAccount = (await activeHrisAccounts([row.subjectEmployeeId])).get(row.subjectEmployeeId);
      if (subjectAccount) recipients.push(subjectAccount);
      const me = await getEmployeeBasic(actor.personId);

      if (input.decision === 'APPROVE') {
        const applied = await handler.apply(tx, actor.accountId, row.id, input.fields ?? {});
        // Gagal menerapkan akibat = seluruh keputusan dibatalkan (rollback), bukan disimpan setengah.
        if (!applied.ok) throw new DecisionAborted(applied);
        await moveStatus(tx, row, 'APPROVED', actor, null);
        await notify(tx, recipients, {
          kind: 'request.approved',
          title: `${type.label} disetujui${me ? ` oleh ${me.name}` : ''}`,
          body: applied.effect,
          link: `/pengajuan/${row.id}`, entity: 'request', entityId: row.id,
        }, actor.accountId);
        return { ok: true as const, data: { id, message: `${requestNumber(id)} disetujui. ${applied.effect}` } };
      }
      await moveStatus(tx, row, 'REJECTED', actor, reason);
      await handler.close?.(tx, actor.accountId, row.id, reason as string);
      await notify(tx, recipients, {
        kind: 'request.rejected',
        title: `Pengajuan ${type.label.toLowerCase()} ditolak`,
        body: `Alasan: ${reason}`,
        link: `/pengajuan/${row.id}`, entity: 'request', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: { id, message: `${requestNumber(id)} ditolak. Pengaju diberi tahu alasannya.` } };
    });
  } catch (error) {
    if (error instanceof DecisionAborted) return error.result;
    throw error;
  }
}

class DecisionAborted extends Error {
  constructor(readonly result: Fail) {
    super(result.error);
  }
}

/**
 * Hangus otomatis oleh mesin terjadwal (mis. usulan ubah gaji lewat batas, spec L4a §3.4). Mesin tidak punya akun,
 * jadi riwayatnya dicatat atas nama pengaju dengan alasan berawalan "Otomatis:". Pengaju diberi tahu.
 */
export async function expireRequest(tx: Tx, id: number, reason: string, handler?: RequestHandler): Promise<boolean> {
  const row = await lockRequest(tx, id);
  if (!row || !isOpen(row.status)) return false;
  const system = { accountId: row.submittedByAccountId, personId: row.submittedByEmployeeId } as Actor;
  const text = `Otomatis: ${reason}`;
  await moveStatus(tx, row, 'EXPIRED', system, text);
  await handler?.close?.(tx, row.submittedByAccountId, row.id, text);
  const type = typeOf(row);
  await notify(tx, [row.submittedByAccountId], {
    kind: 'request.expired',
    title: `${type?.label ?? 'Pengajuan'} hangus`,
    body: reason, link: `/pengajuan/${row.id}`, entity: 'request', entityId: row.id,
  }, null);
  return true;
}
