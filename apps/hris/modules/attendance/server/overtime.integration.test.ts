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

// Lembur (spec L3h §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi. Semua di tanggal lampau (pola L3c).
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_overtime_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');

let admin: postgres.Sql;
let sql: postgres.Sql;
let overtime: typeof import('./overtime');
let review: typeof import('./review');
let engine: typeof import('@/modules/requests');
let files: typeof import('@/modules/files');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let today: string;
let pusat: number;
let shiftId: number;
let ids: Record<'owner' | 'hr' | 'ani' | 'dedi' | 'gudang', number>;
const d = (offset: number) => addDays(today, offset);

describe.skipIf(!ADMIN_URL)('L3h: Lembur', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(tmpdir(), `hris-lembur-${process.pid}`);
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
    process.env.HRIS_OVERTIME_MARKS_FROM = d(-20);
    process.env.HRIS_CLARIFY_MARKS_FROM = d(-20);
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
      dedi: await person('Dedi', 'Pramuniaga'), gudang: await person('Gani', 'Kepala Gudang'),
    };
    overtime = await import('./overtime');
    review = await import('./review');
    engine = await import('@/modules/requests');
    files = await import('@/modules/files');
    handlers = { overtime_claim: overtime.overtimeHandler as unknown as RequestHandler };
    const write = await import('./write');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const hr = await actorOf(ids.hr);
    // Dua shift: Pagi 08-17 dan Siang 12-21, jadi jam tutup toko 21.00.
    for (const [name, startTime, endTime] of [['Pagi', '08:00', '17:00'], ['Siang', '12:00', '21:00']]) {
      const saved = await write.saveShiftVersion(hr, {
        branchId: pusat, name, startTime, endTime, breakMinutes: 60, breakStartFrom: '13:00', breakStartUntil: '15:00',
        effectiveFrom: today, effectiveUntil: null, reason: REASON,
      });
      if (!saved.ok) throw new Error(saved.error);
    }
    await sql`insert into hris.work_shift_versions (shift_id, start_time, end_time, break_minutes, break_start_from, break_start_until,
        effective_from, effective_until, reason, created_by_account_id)
      select shift_id, start_time, end_time, break_minutes, break_start_from, break_start_until, ${d(-30)}, ${d(-1)}, reason, created_by_account_id
      from hris.work_shift_versions`;
    [{ id: shiftId }] = await sql`select id from hris.work_shifts where name = 'Pagi'`;
  });

  afterAll(async () => {
    delete process.env.HRIS_OVERTIME_MARKS_FROM;
    delete process.env.HRIS_CLARIFY_MARKS_FROM;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  /** Tulis jam hari itu lewat Koreksi: jalur yang sama dengan hitung ulang server. */
  const correct = async (by: number, employeeId: number, date: string, outAt: string) => {
    const [latest] = await sql`select max(id) as id from hris.attendance_corrections where employee_id = ${employeeId} and work_date = ${date}`;
    return review.saveCorrections(await actorOf(by), {
      workDate: date, batchBranchId: null, reasonCode: 'OTHER', note: REASON,
      items: [{ employeeId, branchId: pusat, shiftId, inAt: `${date}T08:00`, outAt: `${date}T${outAt}`, baseCorrectionId: latest?.id ? Number(latest.id) : null }],
    });
  };
  const rowOf = async (employeeId: number, date: string) => (await sql`
    select id, hours, state::text as state, choice::text as choice, deadline_at from hris.overtime_days where employee_id = ${employeeId} and work_date = ${date}`)[0];
  const photo = async (employeeId: number) => {
    const uploaded = await files.saveUpload(await actorOf(employeeId), new File([PNG], 'kertas.png', { type: 'image/png' }));
    if (!uploaded.ok) throw new Error(uploaded.error);
    return uploaded.data.id;
  };
  const claim = async (employeeId: number, dayId: number, ordererId: number, withPhoto = true, resubmittedFromId: number | null = null) => engine.submitRequest(
    await actorOf(employeeId), 'overtime_claim', handlers.overtime_claim,
    { fields: { overtimeDayId: dayId, ordererId }, attachmentIds: withPhoto ? [await photo(employeeId)] : [], resubmittedFromId },
  );
  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const decide = async (by: number, id: number, input: { decision: 'APPROVE' | 'REJECT'; reason?: string; fields?: Record<string, unknown> }) => engine.decideRequest(
    await actorOf(by), id, handlers, { ...input, expectedVersion: await versionOf(id) },
  );

  it('jam terdeteksi: pulang 18.10 jadwal 17.00 = 1 jam; 17.50 tidak ada (KEH-159)', async () => {
    expect((await correct(ids.hr, ids.dedi, d(-1), '18:10')).ok).toBe(true);
    expect(await rowOf(ids.dedi, d(-1))).toMatchObject({ hours: 1, state: 'OPEN', choice: 'UNANSWERED' });
    expect((await correct(ids.hr, ids.dedi, d(-2), '17:50')).ok).toBe(true);
    expect(await rowOf(ids.dedi, d(-2))).toBeUndefined();
  });

  it('turun ke 0 sesudah koreksi = VOID, naik lagi = OPEN (spec §3.2)', async () => {
    await correct(ids.hr, ids.dedi, d(-1), '17:30');
    expect(await rowOf(ids.dedi, d(-1))).toMatchObject({ hours: 0, state: 'VOID' });
    await correct(ids.hr, ids.dedi, d(-1), '19:00');
    expect(await rowOf(ids.dedi, d(-1))).toMatchObject({ hours: 2, state: 'OPEN' });
  });

  it('jabatan tidak dapat lembur dan hari tutup: tanpa baris (KEH-25, 165)', async () => {
    await correct(ids.hr, ids.gudang, d(-3), '20:00');
    expect(await rowOf(ids.gudang, d(-3))).toBeUndefined();
    await sql`insert into hris.branch_closures (start_date, end_date, branch_id, reason, backdated, created_by_account_id)
      values (${d(-4)}, ${d(-4)}, ${pusat}, ${REASON}, true, 1)`;
    await correct(ids.hr, ids.ani, d(-4), '20:00');
    expect(await rowOf(ids.ani, d(-4))).toBeUndefined();
  });

  it('klaim: wajib foto, penyuruh sah, milik sendiri (KEH-73, 163)', async () => {
    await correct(ids.hr, ids.ani, d(-1), '20:30');
    const row = await rowOf(ids.ani, d(-1));
    expect(row.hours).toBe(3);
    expect(await claim(ids.ani, row.id, ids.hr, false)).toMatchObject({ ok: false, status: 400 });
    expect(await claim(ids.ani, row.id, ids.ani)).toMatchObject({ ok: false, status: 400 });
    expect(await claim(ids.ani, row.id, ids.dedi)).toMatchObject({ ok: false, status: 400 });
    expect(await claim(ids.dedi, row.id, ids.hr)).toMatchObject({ ok: false, status: 403 });
    expect(await rowOf(ids.ani, d(-1))).toMatchObject({ state: 'OPEN' });
  });

  it('dua kirim bersamaan: satu lolos', async () => {
    const row = await rowOf(ids.ani, d(-1));
    const results = await Promise.all([claim(ids.ani, row.id, ids.hr), claim(ids.ani, row.id, ids.hr)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await rowOf(ids.ani, d(-1))).toMatchObject({ state: 'CLAIMED', choice: 'CLAIMED' });
  });

  it('pengesahan: tidak menaikkan, turun wajib alasan, koreksi di bawah jam disahkan ditolak, cabut membuka lagi (KEH-162, 166)', async () => {
    const row = await rowOf(ids.ani, d(-1));
    const [{ request_id: requestId }] = await sql`select request_id from hris.overtime_claims where overtime_day_id = ${row.id} and active`;
    const id = Number(requestId);
    expect(await decide(ids.hr, id, { decision: 'APPROVE', fields: { approvedHours: 4 } })).toMatchObject({ ok: false, status: 400 });
    expect(await decide(ids.hr, id, { decision: 'APPROVE', fields: { approvedHours: 2 } })).toMatchObject({ ok: false, status: 400 });
    expect((await decide(ids.hr, id, { decision: 'APPROVE', fields: { approvedHours: 2, reductionReason: REASON } })).ok).toBe(true);
    expect(await rowOf(ids.ani, d(-1))).toMatchObject({ state: 'APPROVED' });
    expect((await overtime.overtimeTotalsOf([ids.ani], d(-1), d(-1))).get(ids.ani)).toEqual({ detected: 3, claimed: 3, approved: 2 });

    const blocked = await correct(ids.hr, ids.ani, d(-1), '18:10');
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    expect(blocked.ok ? '' : blocked.error).toMatch(/Cabut dulu/);
    expect((await correct(ids.hr, ids.ani, d(-1), '19:30')).ok).toBe(true);
    expect(await rowOf(ids.ani, d(-1))).toMatchObject({ hours: 2, state: 'APPROVED' });

    const revoked = await engine.revokeRequest(await actorOf(ids.hr), id, await versionOf(id), REASON, handlers);
    expect(revoked.ok).toBe(true);
    expect(await rowOf(ids.ani, d(-1))).toMatchObject({ state: 'OPEN' });
    expect((await overtime.overtimeTotalsOf([ids.ani], d(-1), d(-1))).get(ids.ani)).toMatchObject({ claimed: 0, approved: 0 });
    expect((await correct(ids.hr, ids.ani, d(-1), '18:10')).ok).toBe(true);
  });

  it('jam terdeteksi turun saat klaim menunggu: tidak bisa disahkan melebihi yang terdeteksi', async () => {
    await correct(ids.hr, ids.dedi, d(-1), '20:00');
    const row = await rowOf(ids.dedi, d(-1));
    const sent = await claim(ids.dedi, row.id, ids.hr);
    if (!sent.ok) throw new Error(sent.error);
    await correct(ids.hr, ids.dedi, d(-1), '18:00');
    expect(await decide(ids.hr, sent.data.id, { decision: 'APPROVE', fields: { approvedHours: 3 } })).toMatchObject({ ok: false, status: 400 });
    expect((await decide(ids.hr, sent.data.id, { decision: 'APPROVE', fields: { approvedHours: 1, reductionReason: REASON } })).ok).toBe(true);
  });

  it('ditolak: Ajukan ulang dengan batas lama; milik HR hanya Pemilik/GM (KEH-164)', async () => {
    await correct(ids.owner, ids.hr, d(-1), '19:00');
    const row = await rowOf(ids.hr, d(-1));
    const sent = await claim(ids.hr, row.id, ids.owner);
    if (!sent.ok) throw new Error(sent.error);
    expect(await decide(ids.hr, sent.data.id, { decision: 'APPROVE' })).toMatchObject({ ok: false, status: 403 });
    expect((await decide(ids.owner, sent.data.id, { decision: 'REJECT', reason: REASON })).ok).toBe(true);
    const after = await rowOf(ids.hr, d(-1));
    expect(after).toMatchObject({ state: 'OPEN' });
    expect(new Date(after.deadline_at).getTime()).toBe(new Date(row.deadline_at).getTime());
    expect((await claim(ids.hr, row.id, ids.owner, true, sent.data.id)).ok).toBe(true);
  });

  it('lewat batas: tidak bisa dijawab atau diklaim; mesin menghanguskan sekali dan aman diulang (KEH-161)', async () => {
    await correct(ids.hr, ids.ani, d(-10), '19:00');
    const ani = await rowOf(ids.ani, d(-10));
    expect(await overtime.answerOvertime(await actorOf(ids.ani), { id: ani.id, choice: 'LATER' })).toMatchObject({ ok: false, status: 409 });
    expect(await claim(ids.ani, ani.id, ids.hr)).toMatchObject({ ok: false, status: 409 });
    await overtime.runOvertimeDaily();
    expect(await rowOf(ids.ani, d(-10))).toMatchObject({ state: 'EXPIRED' });
    const count = async () => Number((await sql`select count(*) as n from hris.notifications where title like ${'Lembur 2 jam%hangus'}`)[0].n);
    const first = await count();
    expect(first).toBeGreaterThan(0);
    await overtime.runOvertimeDaily();
    expect(await count()).toBe(first);
  });

  it('lupa pulang yang dijelaskan: batas dari tanggal pengesahan (KEH-165)', async () => {
    await correct(ids.hr, ids.ani, d(-12), '17:00');
    const { db } = await import('@/lib/db');
    await db.transaction(async (tx) => {
      const result = await review.writeClarificationCorrection(tx, {
        employeeId: ids.ani, workDate: d(-12), actorAccountId: 1, note: REASON,
        build: (current) => ({ ...current, outAt: new Date(`${d(-12)}T19:00:00+07:00`) }),
      });
      expect(result.ok).toBe(true);
    });
    const row = await rowOf(ids.ani, d(-12));
    expect(row).toMatchObject({ hours: 2, state: 'OPEN' });
    expect(new Date(row.deadline_at).getTime()).toBe(new Date(`${d(4)}T00:00:00+07:00`).getTime());
  });

  it('Laporan Pulang terkirim → Ini lembur? muncul; jam pulang = jam foto; jawaban disimpan (KEH-89, 160)', async () => {
    const date = d(-6);
    const [{ id: positionId }] = await sql`select id from hris.positions where name = 'Kasir'`;
    const [{ id: versionId }] = await sql`select id from hris.work_shift_versions where shift_id = ${shiftId} and effective_from = ${d(-30)}`;
    const [day] = await sql`insert into hris.attendance_days (employee_id, work_date, branch_id, position_id, shift_id, shift_version_id, shift_source)
      values (${ids.ani}, ${date}, ${pusat}, ${positionId}, ${shiftId}, ${versionId}, 'SOLE') returning id`;
    const fileId = await photo(ids.ani);
    const [attempt] = await sql`insert into hris.attendance_attempts (employee_id, kind, branch_id, result) values (${ids.ani}, 'OUT', ${pusat}, 'OK') returning id`;
    for (const [kind, time] of [['IN', '08:00'], ['OUT', '18:10']]) {
      await sql`insert into hris.attendance_records (day_id, kind, branch_id, recorded_at, latitude, longitude, distance_m, photo_file_id, attempt_id)
        values (${day.id}, ${kind}, ${pusat}, ${new Date(`${date}T${time}:00+07:00`)}, 0, 0, 0, ${fileId}, ${attempt.id})`;
    }
    const ani = await actorOf(ids.ani);
    const now = new Date(`${date}T18:30:00+07:00`);
    // Foto Pulang tanpa Laporan Pulang belum menghitung lembur (KEH-89).
    expect(await overtime.detectOvertime(ids.ani, date, undefined, now)).toMatchObject({ hours: 0, skip: 'NO_OUT' });
    const { submitEndOfDay } = await import('./end-of-day');
    const sent = await submitEndOfDay(ani, {
      dayId: day.id, handover: 'Serah terima uji yang cukup panjang untuk syarat panjang laporan.', recipientMode: 'TEAM', recipientIds: [], handoverPhoto: null, problem: null,
    }, now);
    if (!sent.ok) throw new Error(sent.error);
    expect(sent.data.overtime).toMatchObject({ id: expect.any(Number), hours: 1, outClock: '18.10', scheduledEnd: '17.00' });
    const answered = await overtime.answerOvertime(ani, { id: sent.data.overtime!.id, choice: 'NOT_OVERTIME' }, now);
    expect(answered.ok).toBe(true);
    expect(await rowOf(ids.ani, date)).toMatchObject({ state: 'OPEN', choice: 'NOT_OVERTIME' });
    expect((await overtime.overtimePromptFor(ani, now))?.id).not.toBe(sent.data.overtime!.id);
    // Berubah pikiran: masih bisa dijawab lain sampai batas (contoh 144).
    expect((await overtime.answerOvertime(ani, { id: sent.data.overtime!.id, choice: 'LATER' }, now)).ok).toBe(true);
  });

  it('tidak ada yang dihapus; isi klaim terkunci', async () => {
    await expect(sql`delete from hris.overtime_days`).rejects.toThrow();
    await expect(sql`delete from hris.overtime_claims`).rejects.toThrow();
    await expect(sql`update hris.overtime_claims set claimed_hours = 1`).rejects.toThrow();
  });
});
