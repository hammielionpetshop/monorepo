import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';
import { addDays } from '../rules/schedule';

// Perlu Dijelaskan dan alpha (spec L3g §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Semua kejadian di tanggal lampau (pola L3c) supaya tidak rapuh jam; batas dihitung dari tanggal itu.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_clarify_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';

let admin: postgres.Sql;
let sql: postgres.Sql;
let clarification: typeof import('./clarification');
let review: typeof import('./review');
let absence: typeof import('./absence');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let today: string;
let pusat: number;
let shiftId: number;
let ids: Record<'owner' | 'hr' | 'ani' | 'dedi' | 'eka' | 'fani' | 'gina', number>;
const d = (offset: number) => addDays(today, offset);

describe.skipIf(!ADMIN_URL)('L3g: Perlu Dijelaskan dan alpha', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(tmpdir(), `hris-jelaskan-${process.pid}`);
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    sql = postgres(url.toString(), { max: 4, onnotice: () => {} });
    await sql`create schema petshop`;
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`;
    const { drizzle } = requireAuth('drizzle-orm/postgres-js');
    const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator');
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(new URL('auth/src/migrations/', root)), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth',
    });
    await migrationClient.end();
    const folder = new URL('hris-db/src/migrations/', root);
    for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
      await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
    }
    process.env.DATABASE_URL = url.toString();
    const { todayWib } = await import('@/modules/employees');
    today = todayWib();
    process.env.HRIS_CLARIFY_MARKS_FROM = d(-6);
    [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', -6.2, 106.8) returning id`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${pos.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Pemilik', 'Pemilik'), hr: await person('Nadia HR', 'HR'), ani: await person('Ani', 'Kasir'),
      dedi: await person('Dedi', 'Pramuniaga'), eka: await person('Eka', 'Pramuniaga'), fani: await person('Fani', 'Pramuniaga'),
      gina: await person('Gina', 'Kasir'),
    };
    clarification = await import('./clarification');
    review = await import('./review');
    absence = await import('./absence');
    engine = await import('@/modules/requests');
    handlers = {
      clarification: clarification.clarificationHandler as unknown as RequestHandler,
      absence: absence.absenceHandler as unknown as RequestHandler,
    };
    const write = await import('./write');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);

    const hr = await actorOf(ids.hr);
    const saved = await write.saveShiftVersion(hr, {
      branchId: pusat, name: 'Pagi', startTime: '08:00', endTime: '17:00', breakMinutes: 60, breakStartFrom: '11:00', breakStartUntil: '15:00',
      effectiveFrom: today, effectiveUntil: null, reason: REASON,
    });
    if (!saved.ok) throw new Error(saved.error);
    // Jam yang sama berlaku mundur (data uji; layar tidak membolehkan jam mundur, KEH-02).
    await sql`insert into hris.work_shift_versions (shift_id, start_time, end_time, break_minutes, break_start_from, break_start_until,
        effective_from, effective_until, reason, created_by_account_id)
      select shift_id, start_time, end_time, break_minutes, break_start_from, break_start_until, ${d(-20)}, ${d(-1)}, reason, created_by_account_id
      from hris.work_shift_versions`;
    [{ id: shiftId }] = await sql`select id from hris.work_shifts limit 1`;

    // Hari kerja lampau lewat koreksi HR: Ani masuk tanpa pulang (lupa pulang), Dedi telat 60 menit, semua yang lain hadir penuh.
    const correct = async (employeeId: number, date: string, inAt: string, outAt: string | null) => {
      const result = await review.saveCorrections(hr, {
        workDate: date, batchBranchId: null, reasonCode: 'OTHER', note: REASON,
        items: [{ employeeId, branchId: pusat, shiftId, inAt: `${date}T${inAt}`, outAt: outAt ? `${date}T${outAt}` : null, baseCorrectionId: null }],
      });
      if (!result.ok) throw new Error(result.error);
    };
    for (let offset = -6; offset <= -1; offset += 1) {
      await correct(ids.ani, d(offset), '08:00', offset === -3 ? null : '17:00');
      await correct(ids.dedi, d(offset), offset === -3 ? '09:00' : '08:00', '17:00');
      if (offset !== -2) await correct(ids.gina, d(offset), '08:00', '17:00');
      if (offset !== -5) await correct(ids.fani, d(offset), '08:00', '17:00');
    }
    // HR koreksi untuk dirinya sendiri tidak boleh; HR dibiarkan tanpa absen (ikut alpha, tidak dipakai di tes).
    // Gina mengajukan sakit untuk hari -2 sebelum mesin jalan: hari itu tidak ditandai alpha selama menunggu (KEH-147).
    const sick = await engine.submitRequest(await actorOf(ids.gina), 'absence', handlers.absence, {
      fields: { kind: 'SICK', startDate: d(-2), endDate: d(-2), reason: REASON }, attachmentIds: [],
    });
    if (!sick.ok) throw new Error(sick.error);
    await clarification.runClarificationDaily();
  });

  afterAll(async () => {
    delete process.env.HRIS_CLARIFY_MARKS_FROM;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const events = async (employeeId: number) => (await sql`
    select id, work_date::text as d, kind::text as kind, minutes, state::text as state from hris.clarification_events
    where employee_id = ${employeeId} order by work_date, kind`);
  const eventOf = async (employeeId: number, date: string, kind: string) => (await events(employeeId)).find((e) => e.d === date && e.kind === kind)!;
  const submit = async (employeeId: number, fields: Record<string, unknown>, resubmittedFromId: number | null = null) => (
    engine.submitRequest(await actorOf(employeeId), 'clarification', handlers.clarification, {
      fields: { reason: REASON, ...fields }, attachmentIds: [], resubmittedFromId,
    })
  );
  const version = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const decide = async (by: number, id: number, decision: 'APPROVE' | 'REJECT') => (
    engine.decideRequest(await actorOf(by), id, handlers, { decision, expectedVersion: await version(id), reason: REASON })
  );
  const statusOn = async (employeeId: number, date: string) => {
    const screen = await review.dayRecordScreen(await actorOf(ids.hr), { employeeId, date });
    return screen.card!;
  };

  it('hak awal tertanam: HR memutuskan dan melihat tim; Kasir tidak; Laporan Kebiasaan hanya Pemilik/GM', async () => {
    const hr = await actorOf(ids.hr);
    expect(hr.grants.get('clarification.decide')).toBe('ALL');
    expect(hr.grants.get('clarification.team.view')).toBe('ALL');
    expect(hr.grants.has('clarification.habit.view')).toBe(false);
    expect((await actorOf(ids.ani)).grants.has('clarification.decide')).toBe(false);
    expect(await clarification.habitScreen(hr, null)).toBeNull();
    expect(await clarification.habitScreen(await actorOf(ids.owner), null)).not.toBeNull();
  });

  it('KEH-150, 151: mesin melahirkan lupa pulang, telat, dan alpha; Pemilik tidak; diulang tidak dobel', async () => {
    expect((await events(ids.ani)).map((e) => `${e.d}:${e.kind}`)).toEqual([`${d(-3)}:FORGOT_OUT`]);
    expect((await events(ids.dedi)).map((e) => `${e.d}:${e.kind}:${e.minutes}`)).toEqual([`${d(-3)}:LATE:60`]);
    expect((await events(ids.eka)).map((e) => e.kind)).toEqual(Array(6).fill('ALPHA'));
    expect(await events(ids.owner)).toHaveLength(0);
    const before = (await sql`select count(*)::int as n from hris.clarification_events`)[0].n;
    await clarification.runClarificationDaily();
    expect((await sql`select count(*)::int as n from hris.clarification_events`)[0].n).toBe(before);
    expect((await statusOn(ids.eka, d(-3))).status).toBe('ALPHA');
  });

  it('KEH-147: hari dengan izin/sakit menunggu tidak ditandai alpha; ditolak sesudah harinya lewat → alpha lahir dengan batas baru', async () => {
    expect(await events(ids.gina)).toHaveLength(0);
    const [request] = await sql`select request_id from hris.absence_requests where employee_id = ${ids.gina}`;
    expect((await decide(ids.hr, Number(request.request_id), 'REJECT')).ok).toBe(true);
    const [born] = await events(ids.gina);
    expect(born).toMatchObject({ d: d(-2), kind: 'ALPHA', state: 'OPEN' });
    const [row] = await sql`select deadline_at from hris.clarification_events where id = ${born.id}`;
    expect(new Date(row.deadline_at).getTime()).toBeGreaterThan(Date.now() + 3 * 86_400_000);
  });

  it('KEH-59, 155: lewat batas → alpha tetap; Ajukan terlambat hanya dengan sebab Lupa absen dan alasan terlambat', async () => {
    const expired = await eventOf(ids.fani, d(-5), 'ALPHA');
    expect(expired.state).toBe('EXPIRED');
    expect((await submit(ids.fani, { eventIds: [expired.id], cause: 'SICK' })).ok).toBe(false);
    const noLate = await submit(ids.fani, { eventIds: [expired.id], cause: 'FORGOT', inAt: `${d(-5)}T08:00`, outAt: `${d(-5)}T17:00` });
    expect(noLate.ok).toBe(false);
    const late = await submit(ids.fani, { eventIds: [expired.id], cause: 'FORGOT', inAt: `${d(-5)}T08:00`, outAt: `${d(-5)}T17:00`, lateReason: REASON });
    expect(late.ok).toBe(true);
    expect((await sql`select late from hris.clarifications where employee_id = ${ids.fani}`)[0].late).toBe(true);
  });

  it('hak: kejadian orang lain dan Pemilik ditolak; dua kirim bersamaan untuk satu kejadian hanya satu lolos', async () => {
    const gina = await eventOf(ids.gina, d(-2), 'ALPHA');
    expect((await submit(ids.ani, { eventIds: [gina.id], cause: 'SUDDEN_PERMIT' })).ok).toBe(false);
    expect((await submit(ids.owner, { eventIds: [gina.id], cause: 'SUDDEN_PERMIT' })).ok).toBe(false);
    const both = await Promise.all([
      submit(ids.gina, { eventIds: [gina.id], cause: 'SUDDEN_PERMIT' }), submit(ids.gina, { eventIds: [gina.id], cause: 'SUDDEN_PERMIT' }),
    ]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
  });

  it('KEH-152, 153: rangkaian alpha dijelaskan sakit sekaligus; sakit tanpa surat lebih dari 2 hari ditolak; disetujui → status Sakit', async () => {
    const [b, c, a] = await Promise.all([d(-3), d(-2), d(-1)].map((date) => eventOf(ids.eka, date, 'ALPHA')));
    const tooLong = await submit(ids.eka, { eventIds: [b.id, c.id, a.id], cause: 'SICK' });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error).toContain('Pilih sakit dengan surat dokter');
    const gap = await submit(ids.eka, { eventIds: [b.id, a.id], cause: 'SICK' });
    expect(gap.ok).toBe(false);
    const sent = await submit(ids.eka, { eventIds: [b.id, c.id], cause: 'SICK' });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect((await statusOn(ids.eka, d(-3))).tags).toContain('Penjelasan menunggu keputusan');
    expect((await decide(ids.eka, sent.data.id, 'APPROVE')).ok).toBe(false);
    expect((await decide(ids.hr, sent.data.id, 'APPROVE')).ok).toBe(true);
    expect((await statusOn(ids.eka, d(-3))).status).toBe('SICK');
    expect((await eventOf(ids.eka, d(-2), 'ALPHA')).state).toBe('EXPLAINED');
    const [row] = await sql`select origin::text as origin from hris.absence_requests where request_id = ${sent.data.id}`;
    expect(row.origin).toBe('CLARIFICATION');
  });

  it('KEH-63, 158: lupa pulang disetujui → koreksi "Diisi lewat klarifikasi"; tidak bisa dibalik di Koreksi; Cabut membaliknya', async () => {
    const event = await eventOf(ids.ani, d(-3), 'FORGOT_OUT');
    const bad = await submit(ids.ani, { eventIds: [event.id], cause: 'FORGOT', outAt: `${d(-3)}T07:00` });
    expect(bad.ok).toBe(false);
    const sent = await submit(ids.ani, { eventIds: [event.id], cause: 'FORGOT', outAt: `${d(-3)}T17:05` });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect((await decide(ids.hr, sent.data.id, 'APPROVE')).ok).toBe(true);
    const card = await statusOn(ids.ani, d(-3));
    expect(card.times.OUT).toBe('17.05');
    expect(card.tags).toContain('Diisi lewat klarifikasi');
    const [correction] = await sql`select id from hris.attendance_corrections where reason_code = 'CLARIFICATION' and employee_id = ${ids.ani}`;
    expect((await review.reverseCorrection(await actorOf(ids.hr), { correctionId: Number(correction.id), reason: REASON })).ok).toBe(false);
    const revoked = await engine.revokeRequest(await actorOf(ids.hr), sent.data.id, await version(sent.data.id), REASON, handlers);
    expect(revoked.ok).toBe(true);
    expect((await statusOn(ids.ani, d(-3))).times.OUT).toBe('-');
    expect((await eventOf(ids.ani, d(-3), 'FORGOT_OUT')).state).toBe('OPEN');
  });

  it('KEH-155: ditolak → kejadian kembali terbuka dan bisa diajukan ulang', async () => {
    const event = await eventOf(ids.dedi, d(-3), 'LATE');
    const sent = await submit(ids.dedi, { eventIds: [event.id], cause: 'REASON' });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect((await decide(ids.hr, sent.data.id, 'REJECT')).ok).toBe(true);
    expect((await eventOf(ids.dedi, d(-3), 'LATE')).state).toBe('OPEN');
    const again = await submit(ids.dedi, { eventIds: [event.id], cause: 'REASON' }, sent.data.id);
    expect(again.ok).toBe(true);
  });

  it('koreksi HR yang mengisi hari alpha melepas kejadiannya (VOID)', async () => {
    const result = await review.saveCorrections(await actorOf(ids.hr), {
      workDate: d(-6), batchBranchId: null, reasonCode: 'OTHER', note: REASON,
      items: [{ employeeId: ids.eka, branchId: pusat, shiftId, inAt: `${d(-6)}T08:00`, outAt: `${d(-6)}T17:00`, baseCorrectionId: null }],
    });
    expect(result.ok).toBe(true);
    expect((await eventOf(ids.eka, d(-6), 'ALPHA')).state).toBe('VOID');
  });

  it('tidak ada yang dihapus: kejadian dan penjelasan menolak DELETE', async () => {
    await expect(sql`delete from hris.clarification_events`).rejects.toThrow();
    await expect(sql`delete from hris.clarifications`).rejects.toThrow();
    await expect(sql`update hris.clarification_events set kind = 'LATE'`).rejects.toThrow();
  });
});
