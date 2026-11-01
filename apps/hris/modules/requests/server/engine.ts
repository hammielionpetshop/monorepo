import { eq } from 'drizzle-orm';
import { requestAttachments, requestEvents, requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import {
  can, listEmployeesWithAnyAction, loadActor, recordAudit, type Actor, type ServiceResult, type Target, type Tx,
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
  if (!actor || !type) return { own: false, decider: false, viewer: false, canView: false, canDecide: false, canSeeAttachments: false };
  const own = actor.personId === row.subjectEmployeeId || actor.personId === row.submittedByEmployeeId
    || actor.accountId === row.submittedByAccountId;
  const scope = target ?? { personId: row.subjectEmployeeId };
  // `can()` sudah menolak tindakan selfForbidden atas diri sendiri; isOwnRequest menutup sisanya (KAR-72 butir 2).
  const decider = can(actor, type.decideAction, scope) || (!!type.reviewAction && can(actor, type.reviewAction, scope));
  const viewer = type.extraViewers.some((action) => can(actor, action, scope));
  const canDecide = decider && isOpen(row.status) && !isOwnRequest({
    actorAccountId: actor.accountId, actorPersonId: actor.personId, submittedByAccountId: row.submittedByAccountId,
    submittedByEmployeeId: row.submittedByEmployeeId, subjectEmployeeId: row.subjectEmployeeId,
  });
  return {
    own, decider, viewer,
    canView: own || decider || viewer,
    canDecide,
    // Lampiran tertutup: pengaju, penyetuju, dan Pemilik/GM saja (PRI-23).
    canSeeAttachments: type.confidential ? own || decider || actor.fullAccess : own || decider || viewer,
  };
}

/** Akun yang boleh memutuskan pengajuan ini; kosong → Pemilik/GM (PRI-43 butir 4). Pengaju tidak ikut. */
async function decidersOf(type: RequestTypeDefinition, row: Pick<RequestRow,
  'subjectEmployeeId' | 'submittedByAccountId' | 'submittedByEmployeeId'>, target: Target | null): Promise<number[]> {
  const pick = async (employeeIds: number[]) => {
    const accounts = await activeHrisAccounts(employeeIds);
    const result: number[] = [];
    for (const [employeeId, accountId] of accounts) {
      const actor = await loadActor(accountId, employeeId);
      const scope = target ?? { personId: row.subjectEmployeeId };
      if (!can(actor, type.decideAction, scope)) continue;
      if (isOwnRequest({
        actorAccountId: accountId, actorPersonId: employeeId, submittedByAccountId: row.submittedByAccountId,
        submittedByEmployeeId: row.submittedByEmployeeId, subjectEmployeeId: row.subjectEmployeeId,
      })) continue;
      result.push(accountId);
    }
    return result;
  };
  const deciders = await pick(await listEmployeesWithAnyAction([type.decideAction]));
  return deciders.length ? deciders : pick(await listEmployeesWithAnyAction([]));
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
  if (!actor || !can(actor, type.requestAction, { personId: actor.personId })) {
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
      const recipients = await decidersOf(type, row, subjectTarget);
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

/** BER-L07 Batalkan oleh pengaju selama menunggu (alasan wajib). */
export async function cancelRequest(
  actor: Actor | null, id: number, expectedVersion: number, reasonInput: unknown, handlers: Record<string, RequestHandler> = {},
): Promise<ServiceResult<{ id: number }>> {
  if (!actor) return fail(403, 'Anda tidak berhak membatalkan pengajuan ini.');
  const reason = await checkReason(reasonInput, 'Alasan membatalkan');
  if (!reason.ok) return fail(400, reason.error);
  return db.transaction(async (tx) => {
    const row = await lockRequest(tx, id);
    if (!row) return fail(404, 'Pengajuan tidak ditemukan.');
    if (row.submittedByAccountId !== actor.accountId) return fail(403, 'Hanya pengaju yang bisa membatalkan pengajuan ini.');
    if (!isOpen(row.status)) return fail(409, `Pengajuan ini sudah ${STATUS_LABELS[row.status].toLowerCase()}.`);
    if (row.version !== expectedVersion) return alreadyDecided(row);
    await moveStatus(tx, row, 'CANCELLED', actor, reason.reason);
    await handlers[row.typeKey]?.close?.(tx, actor.accountId, row.id, reason.reason);
    return { ok: true as const, data: { id } };
  });
}

export type DecideInput = { decision: 'APPROVE' | 'REJECT'; expectedVersion: number; reason?: unknown };

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
      if (!roles.canDecide) return fail(403, 'Anda tidak berhak memutuskan pengajuan ini.');

      const recipients = [row.submittedByAccountId];
      const subjectAccount = (await activeHrisAccounts([row.subjectEmployeeId])).get(row.subjectEmployeeId);
      if (subjectAccount) recipients.push(subjectAccount);
      const me = await getEmployeeBasic(actor.personId);

      if (input.decision === 'APPROVE') {
        const applied = await handler.apply(tx, actor.accountId, row.id);
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
