import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { requestAttachments, requestEvents, requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import { can, hasAction, type Actor } from '@/modules/access';
import { listEmployeeBasics, todayWib, type EmployeeBasic } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import {
  REQUEST_STATUSES, isOpen, requestNumber, waitingDays, waitingTone, type RequestStatus,
} from '../rules/status';
import { REQUEST_TYPES, REQUEST_TYPE_KEYS, deciderActions, isRequestTypeKey, type RequestTypeDefinition } from '../rules/types';
import { approvedCancelBlock, canRevoke, rolesOn, typeOf } from './engine';
import type { ChangeRow, RequestHandler } from './handler';

type RequestRow = typeof requests.$inferSelect;

export type RequestCard = {
  id: number;
  number: string;
  typeKey: string;
  typeLabel: string;
  summary: string;
  status: RequestStatus;
  submittedAt: string;
  subjectName: string;
  submitterName: string;
  /** Diisi orang lain atas nama orangnya ("diisi oleh …"). */
  filledByOther: boolean;
  subjectInactive: boolean;
  branchName: string | null;
  waitingDays: number;
  waitingTone: 'none' | 'warn' | 'danger';
  /** Milik sendiri di tab Semua: redup, "diputuskan penyetuju lain" (KAR-72). */
  own: boolean;
  canDecide: boolean;
};

async function overdueDays(): Promise<number> {
  return Number(await settingOn('requests.overdue_days', todayWib())) || 2;
}

function toCard(row: RequestRow, people: Map<number, EmployeeBasic>, actor: Actor | null, overdue: number, now: Date): RequestCard {
  const type = typeOf(row);
  const subject = people.get(row.subjectEmployeeId);
  const submitter = people.get(row.submittedByEmployeeId);
  const roles = rolesOn(actor, row, subject?.target ?? null);
  const days = waitingDays(row.submittedAt, now);
  return {
    id: row.id,
    number: requestNumber(row.id),
    typeKey: row.typeKey,
    typeLabel: type?.label ?? row.typeKey,
    summary: row.summary,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    subjectName: subject?.name ?? '—',
    submitterName: submitter?.name ?? '—',
    filledByOther: row.submittedByEmployeeId !== row.subjectEmployeeId,
    subjectInactive: subject ? !subject.activeToday : false,
    branchName: subject?.branchName ?? null,
    waitingDays: days,
    waitingTone: isOpen(row.status) ? waitingTone(days, overdue) : 'none',
    own: roles.own,
    canDecide: roles.canDecide,
  };
}

async function peopleMap(): Promise<Map<number, EmployeeBasic>> {
  return new Map((await listEmployeeBasics()).map((person) => [person.id, person]));
}

export type MyRequestsFilter = { status?: string; type?: string };

/** BER-L04 Pengajuan Saya: milik orang itu dan yang diisikan atas namanya, terbaru di atas. */
export async function listMyRequests(actor: Actor | null, filter: MyRequestsFilter = {}) {
  if (!actor || actor.positionId == null) return null;
  const rows = await db.select().from(requests)
    .where(or(eq(requests.submittedByAccountId, actor.accountId), eq(requests.subjectEmployeeId, actor.personId)))
    .orderBy(desc(requests.submittedAt), desc(requests.id)).limit(200);
  const status = REQUEST_STATUSES.find((s) => s === filter.status);
  const people = await peopleMap();
  const overdue = await overdueDays();
  const now = new Date();
  const cards = rows
    .filter((row) => (!status || row.status === status) && (!filter.type || row.typeKey === filter.type))
    .map((row) => toCard(row, people, actor, overdue, now));
  return { cards, types: requestableTypes(actor), filter: { status: status ?? '', type: filter.type ?? '' } };
}

/** Jenis yang menjadi hak orang itu (BER-L05). */
export function requestableTypes(actor: Actor | null) {
  return REQUEST_TYPE_KEYS
    .filter((key) => {
      const type: RequestTypeDefinition = REQUEST_TYPES[key];
      if (type.hiddenFromChooser) return false;
      if (type.hiddenForAction && can(actor, type.hiddenForAction)) return false;
      if (type.hiddenForFullAccess && actor?.fullAccess) return false;
      return can(actor, type.requestAction, { personId: actor?.personId });
    })
    .map((key) => {
      const type: RequestTypeDefinition = REQUEST_TYPES[key];
      return { key, label: type.label, description: type.description, deadline: type.deadline.label, formHref: type.formHref ?? null };
    });
}

/** BER-L05: tiap jenis yang berhak + sebab redup bila syaratnya belum terpenuhi. */
export async function getChooseScreen(actor: Actor | null) {
  if (!actor || actor.positionId == null) return null;
  const types = requestableTypes(actor);
  const open = await db.select({ typeKey: requests.typeKey }).from(requests).where(and(
    eq(requests.subjectEmployeeId, actor.personId), inArray(requests.status, ['PENDING', 'REVIEWED']),
  ));
  return types.map((type) => ({
    ...type,
    // Jenis berisian sendiri membatasi per sel, bukan per orang; kembarnya ditolak saat dikirim.
    blockedReason: !type.formHref && open.some((row) => row.typeKey === type.key)
      ? 'Masih ada pengajuan yang menunggu keputusan. Tunggu atau batalkan dulu.' : null,
  }));
}

export type ApprovalTab = 'waiting' | 'decided' | 'all';
export type ApprovalFilter = { tab?: string; type?: string; branch?: string; q?: string };

/** BER-L20 Persetujuan: satu kotak untuk semua jenis. Tidak ada "Setujui semua" (PRI-40 butir 1). */
export async function listApprovals(actor: Actor | null, filter: ApprovalFilter = {}) {
  if (!actor || actor.positionId == null) return null;
  const tab: ApprovalTab = filter.tab === 'decided' || filter.tab === 'all' ? filter.tab : 'waiting';
  const base = db.select().from(requests);
  const rows = tab === 'waiting'
    ? await base.where(inArray(requests.status, ['PENDING', 'REVIEWED'])).orderBy(asc(requests.submittedAt))
    : tab === 'decided'
      ? await base.where(eq(requests.decidedByAccountId, actor.accountId)).orderBy(desc(requests.decidedAt)).limit(200)
      : await base.orderBy(desc(requests.submittedAt)).limit(300);
  const people = await peopleMap();
  const overdue = await overdueDays();
  const now = new Date();
  const q = filter.q?.trim().toLowerCase();
  const cards = rows
    .map((row) => ({ row, card: toCard(row, people, actor, overdue, now), roles: rolesOn(actor, row, people.get(row.subjectEmployeeId)?.target ?? null) }))
    .filter(({ roles, card }) => (tab === 'waiting' ? roles.canDecide : tab === 'decided' ? true : roles.decider || roles.viewer || roles.own)
      && (!filter.type || card.typeKey === filter.type)
      && (!filter.branch || card.branchName === filter.branch)
      && (!q || card.submitterName.toLowerCase().includes(q) || card.subjectName.toLowerCase().includes(q)))
    .map(({ card }) => card);
  const branches = [...new Set(cards.map((c) => c.branchName).filter((b): b is string => !!b))].sort();
  return {
    tab, cards, overdueDays: overdue, branches,
    types: REQUEST_TYPE_KEYS.map((key) => ({ key, label: REQUEST_TYPES[key].label })),
    filter: { type: filter.type ?? '', branch: filter.branch ?? '', q: filter.q ?? '' },
  };
}

/** Angka penanda menu Persetujuan: pengajuan yang menunggu keputusan orang itu. */
export async function waitingSummary(actor: Actor | null): Promise<{ count: number; oldestDays: number; overdueAll: number; overdueDays: number }> {
  const empty = { count: 0, oldestDays: 0, overdueAll: 0, overdueDays: 2 };
  if (!actor || actor.positionId == null) return empty;
  // Dipanggil kerangka tiap halaman: bukan penyetuju tidak perlu memuat daftar orang.
  if (!actor.fullAccess && !deciderActions().some((action) => hasAction(actor, action))) return empty;
  const rows = await db.select().from(requests).where(inArray(requests.status, ['PENDING', 'REVIEWED']));
  if (!rows.length) return { ...empty, overdueDays: await overdueDays() };
  const people = await peopleMap();
  const overdue = await overdueDays();
  const now = new Date();
  const mine = rows.filter((row) => rolesOn(actor, row, people.get(row.subjectEmployeeId)?.target ?? null).canDecide);
  const oldestDays = mine.reduce((max, row) => Math.max(max, waitingDays(row.submittedAt, now)), 0);
  // "Perlu perhatian sistem" hanya untuk Pemilik/GM (PRI-37 butir 4).
  const overdueAll = actor.fullAccess ? rows.filter((row) => waitingDays(row.submittedAt, now) >= overdue).length : 0;
  return { count: mine.length, oldestDays, overdueAll, overdueDays: overdue };
}

export type RequestDetail = {
  card: RequestCard;
  type: { label: string; guideLine: string; confidential: boolean; attachmentRule: string };
  version: number;
  decisionReason: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  changes: ChangeRow[];
  attachments: { fileId: string; label: string }[] | null;
  events: { status: RequestStatus; from: RequestStatus | null; actorName: string; reason: string | null; at: string }[];
  effectPreview: string | null;
  canCancel: boolean;
  /** Sebab pengajuan disetujui tidak bisa dibatalkan lagi (untuk pengaju), atau null. */
  cancelBlockedReason: string | null;
  canRevoke: boolean;
  canResubmit: boolean;
  canDecide: boolean;
  own: boolean;
  resubmittedFromId: number | null;
};

/** BER-L07 / BER-L21: isi, lampiran, riwayat, dan tombol yang berlaku untuk pelaku. */
export async function getRequestDetail(actor: Actor | null, id: number, handlers: Record<string, RequestHandler>)
  : Promise<RequestDetail | null> {
  if (!actor || !Number.isInteger(id)) return null;
  const [row] = await db.select().from(requests).where(eq(requests.id, id));
  if (!row || !isRequestTypeKey(row.typeKey)) return null;
  const handler = handlers[row.typeKey];
  const type = REQUEST_TYPES[row.typeKey] as RequestTypeDefinition;
  const people = await peopleMap();
  const roles = rolesOn(actor, row, people.get(row.subjectEmployeeId)?.target ?? null);
  if (!roles.canView) return null;
  const overdue = await overdueDays();
  const events = await db.select().from(requestEvents).where(eq(requestEvents.requestId, id)).orderBy(asc(requestEvents.id));
  const attachments = roles.canSeeAttachments
    ? (await db.select().from(requestAttachments).where(eq(requestAttachments.requestId, id))).map((a) => ({ fileId: a.fileId, label: a.label }))
    : null;
  return {
    card: toCard(row, people, actor, overdue, new Date()),
    type: { label: type.label, guideLine: type.guideLine, confidential: type.confidential, attachmentRule: type.attachments.rule },
    version: row.version,
    decisionReason: row.decisionReason,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByName: row.decidedByEmployeeId ? people.get(row.decidedByEmployeeId)?.name ?? null : null,
    changes: handler ? await handler.describe(id, roles.own || roles.decider) : [],
    attachments,
    events: events.map((e) => ({
      status: e.toStatus, from: e.fromStatus, actorName: people.get(e.actorEmployeeId)?.name ?? '—', reason: e.reason,
      at: e.createdAt.toISOString(),
    })),
    effectPreview: roles.canDecide && handler ? await handler.effectPreview(id) : null,
    canCancel: (row.submittedByAccountId === actor.accountId || row.subjectEmployeeId === actor.personId)
      && (isOpen(row.status) || (row.status === 'APPROVED' && !(await approvedCancelBlock(row, handler)))),
    cancelBlockedReason: row.status === 'APPROVED' && roles.own && type.cancelAfterApproval ? await approvedCancelBlock(row, handler) : null,
    canRevoke: canRevoke(actor, row, people.get(row.subjectEmployeeId)?.target ?? null),
    canResubmit: row.submittedByAccountId === actor.accountId && row.status === 'REJECTED'
      && can(actor, type.requestAction, { personId: actor.personId }),
    canDecide: roles.canDecide,
    own: roles.own,
    resubmittedFromId: row.resubmittedFromId,
  };
}

/** Id pengajuan menunggu berikutnya untuk tombol "Berikutnya" (PRI-40 butir 1). */
export async function nextWaitingId(actor: Actor | null, afterId: number): Promise<number | null> {
  const list = await listApprovals(actor, { tab: 'waiting' });
  return list?.cards.find((card) => card.id !== afterId)?.id ?? null;
}

/** Pengajuan terbuka satu jenis untuk orang itu (kartu Profil "Menunggu HR"). */
export async function openRequestFor(employeeId: number, typeKey: string): Promise<number | null> {
  const [row] = await db.select({ id: requests.id }).from(requests).where(and(
    eq(requests.subjectEmployeeId, employeeId), eq(requests.typeKey, typeKey), inArray(requests.status, ['PENDING', 'REVIEWED']),
  )).limit(1);
  return row?.id ?? null;
}

/** Lampiran boleh dibuka pelaku ini (route berkas, PRI-23). */
export async function attachmentAllowed(actor: Actor | null, requestId: number, fileId: string): Promise<boolean> {
  if (!actor) return false;
  const [row] = await db.select().from(requests).where(eq(requests.id, requestId));
  if (!row) return false;
  const [link] = await db.select().from(requestAttachments)
    .where(and(eq(requestAttachments.requestId, requestId), eq(requestAttachments.fileId, fileId)));
  if (!link) return false;
  const people = await peopleMap();
  return rolesOn(actor, row, people.get(row.subjectEmployeeId)?.target ?? null).canSeeAttachments;
}

/** Isian lama untuk Ajukan ulang (milik pengaju, berstatus Ditolak). */
export async function resubmitSource(actor: Actor | null, id: number, handlers: Record<string, RequestHandler>) {
  if (!actor) return null;
  const [row] = await db.select().from(requests).where(eq(requests.id, id));
  if (!row || row.submittedByAccountId !== actor.accountId || row.status !== 'REJECTED') return null;
  const handler = handlers[row.typeKey];
  return handler ? { typeKey: row.typeKey, values: await handler.resubmitValues(id), fromId: id } : null;
}

/** Layar Jenis Pengajuan (BER-L42): penyetuju dibaca dari Hak Akses Jabatan. */
export function requestTypeRows(positionNamesWith: (action: string) => string[]) {
  return REQUEST_TYPE_KEYS.map((key) => {
    const type: RequestTypeDefinition = REQUEST_TYPES[key];
    return {
      key, label: type.label, module: type.module,
      approvers: positionNamesWith(type.decideAction),
      reviewers: type.reviewAction ? positionNamesWith(type.reviewAction) : [],
      viewers: type.extraViewers.flatMap((action) => positionNamesWith(action)),
      deadline: type.deadline.label,
      attachments: `${type.attachments.label} — ${type.attachments.rule}`,
      confidential: type.confidential,
      cancelAfterApproval: type.cancelAfterApproval,
      guideLine: type.guideLine,
    };
  });
}
