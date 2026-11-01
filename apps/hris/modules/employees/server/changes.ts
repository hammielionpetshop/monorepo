import { and, eq, isNull } from 'drizzle-orm';
import {
  employmentEvents, fieldPermits, placements, trainingReviews,
} from '@petshop/hris-db/schema/employees';
import { db } from '@/lib/db';
import {
  can, getOrgLookup, recordAudit, type Actor, type ActionName, type OrgLookup, type ServiceResult, type Tx,
} from '@/modules/access';
import { isIsoDate, nextPayrollPeriodStart, todayWib, type IsoDate } from '../rules/dates';
import {
  CHANGE_KINDS, WORK_STATUSES, canCancelPlacement, checkEmploymentEvent, checkPlacementChange,
  deactivationEffectiveOn, type ChangeKind, type WorkStatus,
} from '../rules/history';
import { checkReason } from '@/modules/settings';
import { syncAccountStatus } from './account-sync';
import {
  loadBundle, loadSummaries, lockEmployee, summarize, targetOf, toEventRecords, toPlacementRecords, type EmployeeBundle,
  type EmployeeSummary,
} from './data';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/** Alasan dirapikan; panjang paling sedikit dari pengaturan "Panjang alasan paling sedikit" (PRI-44 butir 2). */
async function cleanReason(value: unknown, label = 'Alasan'): Promise<string | Fail> {
  const checked = await checkReason(value, label);
  return checked.ok ? checked.reason : fail(400, checked.error);
}

type Locked = { bundle: EmployeeBundle; summary: EmployeeSummary; org: OrgLookup; today: IsoDate };

/**
 * Kunci karyawan, muat ulang riwayatnya di dalam transaksi, lalu periksa hak atas orang itu.
 * KAR-74: penempatan/status pemegang jabatan berhak tinggi hanya diubah Pemilik/GM.
 */
async function lockedFor(tx: Tx, actor: Actor | null, id: number, action: ActionName, guardHighRights: boolean)
  : Promise<Locked | Fail> {
  if (!(await lockEmployee(tx, id))) return fail(404, 'Karyawan tidak ditemukan.');
  const [bundle, org] = [await loadBundle(tx, id), await getOrgLookup()];
  if (!bundle) return fail(404, 'Karyawan tidak ditemukan.');
  const today = todayWib();
  const summary = summarize(bundle, org, today);
  if (!actor || !can(actor, action, targetOf(summary))) {
    return fail(403, actor?.personId === id
      ? 'Tindakan ini tidak bisa dilakukan atas diri sendiri.'
      : 'Anda tidak berhak melakukan tindakan ini atas orang ini.');
  }
  if (guardHighRights && summary.positionHighRights && !actor.fullAccess) {
    return fail(403, 'Penempatan dan status pemegang jabatan berhak tinggi hanya diubah Pemilik dan GM.');
  }
  return { bundle, summary, org, today };
}

const isFail = (value: unknown): value is Fail => (value as Fail)?.ok === false;

export type PlacementInput = { kind: ChangeKind; value: number | WorkStatus; effectiveFrom: string; reason: string };

/** Catat perubahan penempatan (KAR-L22, KAR-56): satu catatan satu jenis, bertanggal, beralasan. */
export async function recordPlacement(actor: Actor | null, id: number, input: PlacementInput)
  : Promise<ServiceResult<{ id: number }>> {
  if (!CHANGE_KINDS.includes(input.kind)) return fail(400, 'Jenis perubahan tidak valid.');
  if (!isIsoDate(input.effectiveFrom)) return fail(400, 'Tanggal berlaku wajib diisi.');
  const reason = await cleanReason(input.reason);
  if (isFail(reason)) return reason;
  return db.transaction(async (tx) => {
    const locked = await lockedFor(tx, actor, id, 'placement.record', true);
    if (isFail(locked)) return locked;
    const { org } = locked;
    if (input.kind === 'BRANCH') {
      const branch = org.branches.find((b) => b.id === input.value);
      if (!branch?.active) return fail(400, 'Pilih cabang yang aktif.');
    } else if (input.kind === 'POSITION') {
      const position = org.positions.find((p) => p.id === input.value);
      if (!position?.active) return fail(400, 'Pilih jabatan yang aktif.');
      if (position.highRights && !actor!.fullAccess) return fail(403, 'Jabatan berhak tinggi hanya bisa diisi Pemilik dan GM.');
    } else if (!WORK_STATUSES.includes(input.value as WorkStatus)) {
      return fail(400, 'Status kerja tidak valid.');
    }
    const check = checkPlacementChange({
      records: toPlacementRecords(locked.bundle.placements), kind: input.kind,
      effectiveFrom: input.effectiveFrom, value: input.value,
    });
    if (!check.ok) return fail(400, check.error);
    const [row] = await tx.insert(placements).values({
      employeeId: id, kind: input.kind, ...check.values, effectiveFrom: input.effectiveFrom, reason,
      createdByAccountId: actor!.accountId,
    }).returning();
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'placement', entityId: row.id, action: 'record',
      before: check.base, after: row, reason,
    });
    return { ok: true as const, data: { id: row.id } };
  });
}

/** Batalkan catatan bertanggal depan yang belum berlaku (KAR-56). Promosi tidak bisa dibatalkan (KAR-23). */
export async function cancelPlacement(actor: Actor | null, id: number, placementId: number, reasonInput: string)
  : Promise<ServiceResult<{ id: number }>> {
  const reason = await cleanReason(reasonInput, 'Alasan pembatalan');
  if (isFail(reason)) return reason;
  return db.transaction(async (tx) => {
    const locked = await lockedFor(tx, actor, id, 'placement.record', true);
    if (isFail(locked)) return locked;
    const record = locked.bundle.placements.find((p) => p.id === placementId);
    if (!record) return fail(404, 'Catatan penempatan tidak ditemukan.');
    if (locked.bundle.reviews.some((r) => r.placementId === placementId)) {
      return fail(409, 'Catatan dari Promosi Training tidak bisa dibatalkan; keputusan promosi tidak bisa diubah.');
    }
    const [asRecord] = toPlacementRecords([record]);
    if (!canCancelPlacement(asRecord, locked.today)) {
      return fail(409, 'Hanya catatan bertanggal depan yang belum berlaku yang bisa dibatalkan. Yang sudah berlaku dibetulkan dengan catatan baru.');
    }
    const [after] = await tx.update(placements).set({
      cancelledAt: new Date(), cancelledByAccountId: actor!.accountId, cancelReason: reason,
    }).where(eq(placements.id, placementId)).returning();
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'placement', entityId: placementId, action: 'cancel',
      before: record, after, reason,
    });
    return { ok: true as const, data: { id: placementId } };
  });
}

export type DeactivateInput = {
  lastWorkingDay: string;
  reasonKind: 'RESIGNED' | 'DISMISSED' | 'OTHER';
  resignationNotice: 'WITH_NOTICE' | 'WITHOUT_NOTICE' | null;
  note: string;
};

export type StatusResult = ServiceResult<{ id: number; effectiveOn: IsoDate; accountApplied: boolean; accountError?: string }>;

async function afterStatusChange(actor: Actor, id: number, eventId: number, effectiveOn: IsoDate): Promise<StatusResult> {
  if (effectiveOn > todayWib()) return { ok: true, data: { id: eventId, effectiveOn, accountApplied: false } };
  try {
    await syncAccountStatus(id, actor.accountId);
    return { ok: true, data: { id: eventId, effectiveOn, accountApplied: true } };
  } catch (error) {
    // Data HRIS sudah tersimpan dan akses HRIS sudah mengikuti; job harian mengulang penyesuaian akun.
    return {
      ok: true,
      data: { id: eventId, effectiveOn, accountApplied: false, accountError: error instanceof Error ? error.message : String(error) },
    };
  }
}

/** Nonaktifkan (KAR-L23, KAR-55): tanggal terakhir bekerja + alasan. Tanpa pemberitahuan hanya Pemilik/GM (KAR-68). */
export async function deactivateEmployee(actor: Actor | null, id: number, input: DeactivateInput): Promise<StatusResult> {
  if (!isIsoDate(input.lastWorkingDay)) return fail(400, 'Tanggal terakhir bekerja wajib diisi.');
  if (!['RESIGNED', 'DISMISSED', 'OTHER'].includes(input.reasonKind)) return fail(400, 'Alasan nonaktif tidak valid.');
  const notice = input.reasonKind === 'RESIGNED' ? input.resignationNotice : null;
  if (input.reasonKind === 'RESIGNED' && notice !== 'WITH_NOTICE' && notice !== 'WITHOUT_NOTICE') {
    return fail(400, 'Pilih cara berhenti.');
  }
  const note = await cleanReason(input.note, 'Keterangan');
  if (isFail(note)) return note;
  const effectiveOn = deactivationEffectiveOn(input.lastWorkingDay);
  const saved = await db.transaction(async (tx) => {
    const locked = await lockedFor(tx, actor, id, 'employee.activation', true);
    if (isFail(locked)) return locked;
    if (notice === 'WITHOUT_NOTICE' && !can(actor, 'resignation.set_unnotified', targetOf(locked.summary))) {
      return fail(403, 'Berhenti tanpa pemberitahuan hanya ditetapkan Pemilik dan GM.');
    }
    const check = checkEmploymentEvent({
      events: toEventRecords(locked.bundle.events), kind: 'DEACTIVATE', effectiveOn, joinedOn: locked.bundle.employee.joinedOn,
    });
    if (!check.ok) return fail(409, check.error);
    const [row] = await tx.insert(employmentEvents).values({
      employeeId: id, kind: 'DEACTIVATE', effectiveOn, reasonKind: input.reasonKind, resignationNotice: notice,
      note, createdByAccountId: actor!.accountId,
    }).returning();
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'employment_event', entityId: row.id, action: 'deactivate', after: row, reason: note,
    });
    return { ok: true as const, data: { id: row.id } };
  });
  if (!saved.ok) return saved;
  return afterStatusChange(actor!, id, saved.data.id, effectiveOn);
}

/** Aktifkan lagi (KAR-07): riwayat lama tetap; penempatan memakai yang terakhir. */
export async function reactivateEmployee(actor: Actor | null, id: number, input: { startDate: string; note: string })
  : Promise<StatusResult> {
  if (!isIsoDate(input.startDate)) return fail(400, 'Tanggal mulai aktif wajib diisi.');
  const note = await cleanReason(input.note);
  if (isFail(note)) return note;
  const saved = await db.transaction(async (tx) => {
    const locked = await lockedFor(tx, actor, id, 'employee.activation', true);
    if (isFail(locked)) return locked;
    const check = checkEmploymentEvent({
      events: toEventRecords(locked.bundle.events), kind: 'REACTIVATE', effectiveOn: input.startDate,
      joinedOn: locked.bundle.employee.joinedOn,
    });
    if (!check.ok) return fail(409, check.error);
    const [row] = await tx.insert(employmentEvents).values({
      employeeId: id, kind: 'REACTIVATE', effectiveOn: input.startDate, note, createdByAccountId: actor!.accountId,
    }).returning();
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'employment_event', entityId: row.id, action: 'reactivate', after: row, reason: note,
    });
    return { ok: true as const, data: { id: row.id } };
  });
  if (!saved.ok) return saved;
  return afterStatusChange(actor!, id, saved.data.id, input.startDate);
}

/** Izin tugas lapangan (KAR-L24, KAR-64): beri atau cabut (cabut wajib alasan). */
export async function setFieldPermit(actor: Actor | null, id: number,
  input: { kind: 'DRIVE' | 'ASSIST'; granted: boolean; reason?: string }): Promise<ServiceResult<{ id: number }>> {
  if (input.kind !== 'DRIVE' && input.kind !== 'ASSIST') return fail(400, 'Jenis izin tidak valid.');
  const reason = input.granted ? null : await cleanReason(input.reason, 'Alasan mencabut');
  if (isFail(reason)) return reason;
  return db.transaction(async (tx) => {
    const locked = await lockedFor(tx, actor, id, 'field_permit.update', false);
    if (isFail(locked)) return locked;
    if (!locked.summary.activeToday) return fail(409, 'Orang nonaktif tidak bisa diberi izin.');
    const current = locked.bundle.permits.find((p) => p.kind === input.kind && !p.revokedAt);
    if (input.granted) {
      if (current) return fail(409, 'Izin ini sudah aktif.');
      const [row] = await tx.insert(fieldPermits).values({
        employeeId: id, kind: input.kind, grantedByAccountId: actor!.accountId,
      }).returning();
      await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'field_permit', entityId: row.id, action: 'grant', after: row });
      return { ok: true as const, data: { id: row.id } };
    }
    if (!current) return fail(409, 'Izin ini tidak sedang aktif.');
    const [row] = await tx.update(fieldPermits).set({
      revokedAt: new Date(), revokedByAccountId: actor!.accountId, revokeReason: reason,
    }).where(and(eq(fieldPermits.id, current.id), isNull(fieldPermits.revokedAt))).returning();
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'field_permit', entityId: row.id, action: 'revoke', before: current, after: row, reason,
    });
    return { ok: true as const, data: { id: row.id } };
  });
}

export type PromotionInput =
  | { decision: 'APPROVE' }
  | { decision: 'DEFER'; reviewAgainOn: string; reason: string };

/** Putuskan Promosi Training (KAR-L27, KAR-21–23). Disetujui → Karyawan mulai awal periode gaji berikutnya. */
export async function decidePromotion(actor: Actor | null, id: number, input: PromotionInput)
  : Promise<ServiceResult<{ id: number; effectiveOn: IsoDate | null }>> {
  return db.transaction(async (tx) => {
    const locked = await lockedFor(tx, actor, id, 'training_promotion.decide', false);
    if (isFail(locked)) return locked;
    if (!locked.summary.promotionDueOn) return fail(409, 'Orang ini tidak sedang menunggu penilaian training.');
    if (input.decision === 'DEFER') {
      if (!isIsoDate(input.reviewAgainOn) || input.reviewAgainOn <= locked.today) {
        return fail(400, 'Tanggal "nilai lagi pada" wajib diisi dan harus sesudah hari ini.');
      }
      const reason = await cleanReason(input.reason);
      if (isFail(reason)) return reason;
      const [row] = await tx.insert(trainingReviews).values({
        employeeId: id, decision: 'DEFER', reviewAgainOn: input.reviewAgainOn, reason, decidedByAccountId: actor!.accountId,
      }).returning();
      await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'training_review', entityId: row.id, action: 'defer', after: row, reason });
      return { ok: true as const, data: { id: row.id, effectiveOn: null } };
    }
    const effectiveOn = nextPayrollPeriodStart(locked.today);
    const check = checkPlacementChange({
      records: toPlacementRecords(locked.bundle.placements), kind: 'WORK_STATUS', effectiveFrom: effectiveOn,
      value: 'EMPLOYEE', viaPromotion: true,
    });
    if (!check.ok) return fail(409, check.error);
    const [placement] = await tx.insert(placements).values({
      employeeId: id, kind: 'WORK_STATUS', ...check.values, effectiveFrom: effectiveOn,
      reason: 'Promosi Training disetujui.', createdByAccountId: actor!.accountId,
    }).returning();
    const [row] = await tx.insert(trainingReviews).values({
      employeeId: id, decision: 'APPROVE', promotionEffectiveOn: effectiveOn, placementId: placement.id,
      decidedByAccountId: actor!.accountId,
    }).returning();
    await recordAudit(tx, {
      actorAccountId: actor!.accountId, entity: 'training_review', entityId: row.id, action: 'approve', after: { review: row, placement },
    });
    return { ok: true as const, data: { id: row.id, effectiveOn } };
  });
}

/** Antrean Promosi Training: hanya orang yang boleh diputuskan pelaku. */
export async function listPromotionQueue(actor: Actor | null) {
  const { summaries, today } = await loadSummaries();
  return {
    today,
    nextPeriodStart: nextPayrollPeriodStart(today),
    rows: summaries
      .filter((s) => s.promotionDueOn && can(actor, 'training_promotion.decide', targetOf(s)))
      .sort((a, b) => (a.promotionDueOn! < b.promotionDueOn! ? -1 : 1)),
  };
}

/**
 * Pindah cabang dari pengajuan yang disetujui (KEH-27, spec L3d §9 butir 7), di transaksi keputusannya.
 * Hak sudah diperiksa Mesin Pengajuan; di sini tetap dijaga KAR-74 (jabatan berhak tinggi hanya Pemilik/GM).
 */
export async function moveBranchFromRequest(tx: Tx, input: {
  actorAccountId: number; deciderFullAccess: boolean; employeeId: number; branchId: number; effectiveFrom: IsoDate; reason: string;
}): Promise<{ ok: true; placementId: number } | Fail> {
  if (!(await lockEmployee(tx, input.employeeId))) return fail(404, 'Karyawan tidak ditemukan.');
  const [bundle, org] = [await loadBundle(tx, input.employeeId), await getOrgLookup()];
  if (!bundle) return fail(404, 'Karyawan tidak ditemukan.');
  const summary = summarize(bundle, org, todayWib());
  if (summary.positionHighRights && !input.deciderFullAccess) {
    return fail(403, 'Penempatan pemegang jabatan berhak tinggi hanya diubah Pemilik dan GM.');
  }
  if (!org.branches.find((branch) => branch.id === input.branchId)?.active) return fail(400, 'Cabang tujuan sudah tidak aktif.');
  const check = checkPlacementChange({
    records: toPlacementRecords(bundle.placements), kind: 'BRANCH', effectiveFrom: input.effectiveFrom, value: input.branchId,
  });
  if (!check.ok) return fail(409, check.error);
  const [row] = await tx.insert(placements).values({
    employeeId: input.employeeId, kind: 'BRANCH', ...check.values, effectiveFrom: input.effectiveFrom, reason: input.reason,
    createdByAccountId: input.actorAccountId,
  }).returning();
  await recordAudit(tx, {
    actorAccountId: input.actorAccountId, entity: 'placement', entityId: row.id, action: 'record',
    before: check.base, after: row, reason: input.reason,
  });
  return { ok: true, placementId: row.id };
}
