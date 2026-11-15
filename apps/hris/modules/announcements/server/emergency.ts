import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { announcementReads, announcements, announcementTargets } from '@petshop/hris-db/schema/announcements';
import { db } from '@/lib/db';
import { can, getOrgLookup, recordAudit, type Actor } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import { settingsOn } from '@/modules/settings';
import {
  checkEndReason, emergencyStatus, lastAllowedDate, validateEmergency,
  type EmergencyInput, type EmergencyStatus, type EmergencyTarget,
} from '../rules/emergency';

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const fail = (status: number, error: string) => ({ ok: false as const, status, error });

export type EmergencyLimitsView = { maxChars: number; maxDays: number; today: string; lastDate: string; holdSeconds: number };

/** Batas kirim dan jeda tombol dari pengaturan hari ini (spec F3-2 §6). */
export async function emergencyLimits(): Promise<EmergencyLimitsView> {
  const today = todayWib();
  const values = await settingsOn(['announcements.emergency_max_chars', 'announcements.emergency_max_days', 'shared.hold_seconds_emergency'], today);
  const maxChars = Number(values['announcements.emergency_max_chars']) || 300;
  const maxDays = Number(values['announcements.emergency_max_days']) || 7;
  return { maxChars, maxDays, today, lastDate: lastAllowedDate(today, maxDays), holdSeconds: Number(values['shared.hold_seconds_emergency']) || 5 };
}

/**
 * Penempatan (cabang `b`, jabatan `p`) termasuk sasaran pengumuman `a`? Irisan cabang dan jabatan; daftar kosong
 * di satu sisi = semua (spec F3-2 §3.1). Dihitung saat dibaca, jadi orang yang pindah ikut menerima (BER-L25).
 */
export function matchesAnnouncement(b: SQL, p: SQL): SQL {
  return sql`(a.target_all or (
    (not exists (select 1 from hris.announcement_targets t where t.announcement_id = a.id and t.branch_id is not null)
      or exists (select 1 from hris.announcement_targets t where t.announcement_id = a.id and t.branch_id = ${b}))
    and (not exists (select 1 from hris.announcement_targets t where t.announcement_id = a.id and t.position_id is not null)
      or exists (select 1 from hris.announcement_targets t where t.announcement_id = a.id and t.position_id = ${p}))))`;
}

const showing = sql`(a.ended_at is null and a.shows_from <= now() and a.shows_until > now())`;

export function idList(ids: number[]): SQL {
  return sql.join(ids.map((id) => sql`${id}`), sql`, `);
}

/** Jumlah penerima untuk sasaran yang sedang dipilih (langkah 2–3 layar kirim). */
export async function countRecipients(target: EmergencyTarget): Promise<number> {
  let where = sql`true`;
  if (!target.all) {
    const branch = target.branchIds.length ? sql`cp.branch_id in (${idList(target.branchIds)})` : sql`true`;
    const position = target.positionIds.length ? sql`cp.position_id in (${idList(target.positionIds)})` : sql`true`;
    if (!target.branchIds.length && !target.positionIds.length) return 0;
    where = sql`${branch} and ${position}`;
  }
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from hris.current_placements cp where cp.active and ${where}`);
  return Number(row?.n ?? 0);
}

export async function sendEmergency(actor: Actor | null, input: EmergencyInput): Promise<Result<{ id: number; recipients: number }>> {
  if (!actor || !can(actor, 'announcement.emergency.send')) return fail(403, 'Anda tidak berhak mengirim pengumuman darurat.');
  const limits = await emergencyLimits();
  const checked = validateEmergency(input, limits);
  if (!checked.ok) return fail(400, checked.error);
  const { title, message, target, showsUntil } = checked.value;
  const recipients = await countRecipients(target);
  if (recipients === 0) return fail(400, 'Tidak ada karyawan aktif pada sasaran ini.');
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(announcements).values({
      kind: 'EMERGENCY', title, message, targetAll: target.all, showsUntil,
      createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId,
    }).returning({ id: announcements.id });
    if (!target.all) {
      const rows = [
        ...target.branchIds.map((branchId) => ({ announcementId: row.id, branchId, positionId: null })),
        ...target.positionIds.map((positionId) => ({ announcementId: row.id, branchId: null, positionId })),
      ];
      if (rows.length) await tx.insert(announcementTargets).values(rows);
    }
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'announcement', entityId: row.id, action: 'emergency.send',
      after: { title, message, target, showsUntil: showsUntil.toISOString(), recipients },
    });
    return row.id;
  });
  return { ok: true, value: { id, recipients } };
}

export async function endEmergency(actor: Actor | null, id: number, reason: string): Promise<Result<null>> {
  if (!actor || !can(actor, 'announcement.emergency.send')) return fail(403, 'Anda tidak berhak mengakhiri pengumuman darurat.');
  const checked = checkEndReason(reason);
  if (!checked.ok) return fail(400, checked.error);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(announcements)
      .set({ endedAt: sql`now()`, endedByAccountId: actor.accountId, endReason: checked.value })
      .where(and(eq(announcements.id, id), eq(announcements.kind, 'EMERGENCY'), isNull(announcements.endedAt), sql`${announcements.showsUntil} > now()`))
      .returning({ id: announcements.id });
    if (!row) return fail(409, 'Pengumuman ini sudah tidak tayang (berakhir atau sudah diakhiri).');
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'announcement', entityId: id, action: 'emergency.end', reason: checked.value });
    return { ok: true as const, value: null };
  });
}

export type EmergencyRow = {
  id: number; title: string; message: string; targetText: string; senderName: string | null;
  createdAt: string; showsUntil: string; status: EmergencyStatus; endReason: string | null; endedAt: string | null;
  readCount: number; recipientCount: number;
};

type RawRow = {
  id: number; title: string; message: string; target_all: boolean; sender_name: string | null; created_at: string | Date;
  shows_until: string | Date | null; ended_at: string | Date | null; end_reason: string | null; read_count: number; recipient_count: number;
};

export const iso = (value: string | Date) => new Date(value).toISOString();

/** Penerima = karyawan aktif yang cocok sasaran sekarang, ditambah yang sudah membaca (walau sudah pindah). */
export const recipientCount = sql`(select count(*)::int from (
  select cp.employee_id from hris.current_placements cp where cp.active and ${matchesAnnouncement(sql`cp.branch_id`, sql`cp.position_id`)}
  union select r.employee_id from hris.announcement_reads r where r.announcement_id = a.id) x)`;

async function loadRows(where: SQL): Promise<EmergencyRow[]> {
  const rows = await db.execute<RawRow>(sql`
    select a.id, a.title, a.message, a.target_all, e.name as sender_name, a.created_at, a.shows_until, a.ended_at, a.end_reason,
      (select count(*)::int from hris.announcement_reads r where r.announcement_id = a.id) as read_count,
      ${recipientCount} as recipient_count
    from hris.announcements a left join hris.employees e on e.id = a.created_by_employee_id
    where a.kind = 'EMERGENCY' and ${where}
    order by a.created_at desc limit 200`);
  if (!rows.length) return [];
  const texts = await targetTexts(rows.map((row) => ({ id: Number(row.id), targetAll: row.target_all })));
  return rows.map((row) => {
    const targetText = texts.get(Number(row.id)) ?? '';
    const endedAt = row.ended_at ? new Date(row.ended_at) : null;
    return {
      id: Number(row.id), title: row.title, message: row.message, targetText, senderName: row.sender_name,
      createdAt: iso(row.created_at), showsUntil: iso(row.shows_until!),
      status: emergencyStatus({ showsUntil: new Date(row.shows_until!), endedAt }),
      endReason: row.end_reason, endedAt: endedAt ? endedAt.toISOString() : null,
      readCount: Number(row.read_count), recipientCount: Number(row.recipient_count),
    };
  });
}

/** Teks sasaran ("Cabang: Singaparna · semua jabatan") per pengumuman. */
export async function targetTexts(rows: { id: number; targetAll: boolean }[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!rows.length) return result;
  const [targets, org] = await Promise.all([
    db.select().from(announcementTargets).where(sql`${announcementTargets.announcementId} in (${idList(rows.map((row) => row.id))})`),
    getOrgLookup(),
  ]);
  const branchName = new Map(org.branches.map((b) => [b.id, b.name]));
  const positionName = new Map(org.positions.map((p) => [p.id, p.name]));
  for (const row of rows) {
    const own = targets.filter((t) => t.announcementId === row.id);
    const branches = own.filter((t) => t.branchId != null).map((t) => branchName.get(t.branchId!) ?? `Cabang #${t.branchId}`);
    const positions = own.filter((t) => t.positionId != null).map((t) => positionName.get(t.positionId!) ?? `Jabatan #${t.positionId}`);
    result.set(row.id, row.targetAll ? 'Semua orang'
      : [branches.length ? `Cabang: ${branches.join(', ')}` : 'Semua cabang', positions.length ? `Jabatan: ${positions.join(', ')}` : 'semua jabatan'].join(' · '));
  }
  return result;
}

function canView(actor: Actor | null): actor is Actor {
  return !!actor && (can(actor, 'announcement.view') || can(actor, 'announcement.emergency.send'));
}

/** Kantor › Pengumuman (BER-L22): daftar darurat, terbaru dulu. */
export async function listEmergencies(actor: Actor | null): Promise<Result<{ rows: EmergencyRow[]; canSend: boolean }>> {
  if (!canView(actor)) return fail(403, 'Anda tidak berhak membuka Pengumuman.');
  return { ok: true, value: { rows: await loadRows(sql`true`), canSend: can(actor, 'announcement.emergency.send') } };
}

export type ReaderRow = { employeeId: number; name: string; branch: string | null; position: string | null; readAt: string | null };

/** Siapa sudah dan belum baca (BER-L25). */
export async function emergencyReaders(actor: Actor | null, id: number): Promise<Result<{ announcement: EmergencyRow; readers: ReaderRow[]; canEnd: boolean }>> {
  if (!canView(actor)) return fail(403, 'Anda tidak berhak melihat siapa sudah membaca.');
  const [announcement] = await loadRows(sql`a.id = ${id}`);
  if (!announcement) return fail(404, 'Pengumuman tidak ditemukan.');
  return {
    ok: true,
    value: { announcement, readers: await readersOf(id), canEnd: can(actor, 'announcement.emergency.send') && announcement.status === 'SHOWING' },
  };
}

/** Sasaran hari ini + yang sudah membaca, belum baca di atas (BER-L25). */
export async function readersOf(id: number): Promise<ReaderRow[]> {
  const rows = await db.execute<{ employee_id: number; name: string; branch: string | null; position: string | null; read_at: string | Date | null }>(sql`
    with people as (
      select cp.employee_id from hris.announcements a
        join hris.current_placements cp on cp.active and ${matchesAnnouncement(sql`cp.branch_id`, sql`cp.position_id`)}
        where a.id = ${id}
      union select r.employee_id from hris.announcement_reads r where r.announcement_id = ${id})
    select p.employee_id, e.name, b.name as branch, pos.name as position, r.read_at
    from people p
    join hris.employees e on e.id = p.employee_id
    left join hris.current_placements cp on cp.employee_id = p.employee_id
    left join hris.branches b on b.id = cp.branch_id
    left join hris.positions pos on pos.id = cp.position_id
    left join hris.announcement_reads r on r.announcement_id = ${id} and r.employee_id = p.employee_id
    order by (r.read_at is null) desc, e.name`);
  return rows.map((row) => ({
    employeeId: Number(row.employee_id), name: row.name, branch: row.branch, position: row.position,
    readAt: row.read_at ? iso(row.read_at) : null,
  }));
}

export type EmergencyQueueItem = { id: number; title: string; message: string; senderName: string | null; createdAt: string };

/**
 * Darurat yang masih tayang, mengenai orang ini, dan belum ia baca — terbaru dulu (spec F3-2 §3.4).
 * Satu query ringan; dipanggil tiap menit oleh jendela antrean. Akses terbatas tidak mendapat apa pun.
 */
export async function pendingEmergencies(actor: Actor | null, onlyId?: number): Promise<EmergencyQueueItem[]> {
  if (!actor || actor.limited) return [];
  const rows = await db.execute<{ id: number; title: string; message: string; sender_name: string | null; created_at: string | Date }>(sql`
    select a.id, a.title, a.message, e.name as sender_name, a.created_at
    from hris.current_placements cp
    join hris.announcements a on a.kind = 'EMERGENCY' and ${showing} and ${matchesAnnouncement(sql`cp.branch_id`, sql`cp.position_id`)}
    left join hris.employees e on e.id = a.created_by_employee_id
    where cp.employee_id = ${actor.personId} and cp.active
      ${onlyId == null ? sql`` : sql`and a.id = ${onlyId}`}
      and not exists (select 1 from hris.announcement_reads r where r.announcement_id = a.id and r.employee_id = ${actor.personId})
    order by a.created_at desc, a.id desc`);
  return rows.map((row) => ({ id: Number(row.id), title: row.title, message: row.message, senderName: row.sender_name, createdAt: iso(row.created_at) }));
}

/** "Sudah saya baca": hanya sasaran yang masih tayang; diulang tetap satu baris. */
export async function markEmergencyRead(actor: Actor | null, id: number): Promise<Result<null>> {
  if (!actor || actor.limited) return fail(403, 'Anda tidak berhak.');
  const [already] = await db.select({ id: announcementReads.id }).from(announcementReads)
    .where(and(eq(announcementReads.announcementId, id), eq(announcementReads.employeeId, actor.personId)));
  if (already) return { ok: true, value: null };
  const [pending] = await pendingEmergencies(actor, id);
  if (!pending) return fail(409, 'Pengumuman ini sudah tidak tayang untuk Anda.');
  await db.insert(announcementReads).values({ announcementId: id, employeeId: actor.personId, accountId: actor.accountId }).onConflictDoNothing();
  return { ok: true, value: null };
}

/** Pilihan cabang dan jabatan aktif untuk langkah Sasaran. */
export async function emergencyFormOptions(actor: Actor | null): Promise<Result<{ branches: { id: number; name: string }[]; positions: { id: number; name: string }[]; limits: EmergencyLimitsView }>> {
  if (!actor || !can(actor, 'announcement.emergency.send')) return fail(403, 'Anda tidak berhak mengirim pengumuman darurat.');
  const [org, limits] = await Promise.all([getOrgLookup(), emergencyLimits()]);
  return {
    ok: true,
    value: {
      branches: org.branches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name })),
      positions: org.positions.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })),
      limits,
    },
  };
}
