import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import { wibInstant } from '../rules/attendance';
import { addDays } from '../rules/schedule';

// Alur Absen dan Istirahat (spec L3b §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_attendance_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';
const POINT = { latitude: -7.350564720030627, longitude: 108.10865608125447, accuracy: 12 };
const FAR = { latitude: -7.33, longitude: 108.2, accuracy: 30 };
// Bait JPEG terkecil yang dikenali pemeriksa berkas.
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1])], 'absen.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let check: typeof import('./check');
let write: typeof import('./write');
let actorOf: (employeeId: number) => Promise<Actor>;
let day: string;
let at: (time: string, date?: string) => Date;
let pusat: number;
let depan: number;
let codePusat: string;
let codeDepan: string;
let ids: Record<'hr' | 'head' | 'ani' | 'budi' | 'citra' | 'dedi' | 'eka' | 'fani' | 'gudang' | 'owner' | 'foreignHead' | 'hana' | 'ina', number>;

describe.skipIf(!ADMIN_URL)('L3b: Absen dan Istirahat', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(tmpdir(), `hris-absen-${process.pid}`);
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} });
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
    [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', ${POINT.latitude}, ${POINT.longitude}) returning id`;
    [{ id: depan }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Depan', ${POINT.latitude}, ${POINT.longitude}) returning id`;

    const person = async (name: string, position: string, branchId = pusat) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branchId}, ${pos.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Pemilik', 'Pemilik'), hr: await person('Nadia HR', 'HR'), head: await person('Kepala Pusat', 'Kepala Toko'),
      ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir'), citra: await person('Citra', 'Kasir'),
      dedi: await person('Dedi', 'Pramuniaga'), eka: await person('Eka', 'Pramuniaga'), fani: await person('Fani', 'Pramuniaga'),
      gudang: await person('Gani', 'Pramuniaga'), foreignHead: await person('Kepala Depan', 'Kepala Toko', depan),
      hana: await person('Hana', 'Kasir', depan), ina: await person('Ina', 'Kasir', depan),
    };
    process.env.DATABASE_URL = url.toString();
    check = await import('./check');
    write = await import('./write');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const { todayWib } = await import('@/modules/employees');
    day = todayWib();
    at = (time, date = day) => wibInstant(date, time);

    const hr = await actorOf(ids.hr);
    const shift = async (branchId: number, name: string, startTime: string, endTime: string) => {
      const result = await write.saveShiftVersion(hr, {
        branchId, name, startTime, endTime, breakMinutes: 60, breakStartFrom: '11:00', breakStartUntil: '15:00',
        effectiveFrom: day, effectiveUntil: null, reason: REASON,
      });
      if (!result.ok) throw new Error(result.error);
    };
    await shift(pusat, 'Pagi', '08:00', '17:00');
    await shift(depan, 'Sore', '13:00', '21:00');
    for (const branchId of [pusat, depan]) {
      const result = await write.regenerateQr(hr, branchId);
      if (!result.ok) throw new Error(result.error);
    }
    const qr = async (branchId: number) => (await sql`select code from hris.branch_qr_codes where branch_id = ${branchId} and dead_at is null`)[0].code as string;
    codePusat = await qr(pusat);
    codeDepan = await qr(depan);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  /** Langkah lengkap sampai Kirim pada jam tertentu. */
  async function fullCheck(employeeId: number, kind: 'IN' | 'RETURN' | 'OUT', now: Date, code = codePusat, point = POINT, extra: { assist?: boolean; shiftId?: number | null } = {}) {
    const actor = await actorOf(employeeId);
    const located = await check.checkLocation(actor, { code, kind, ...point, ...extra }, now);
    if (!located.ok) return located;
    return check.submitAttendance(actor, { attemptId: located.data.attemptId, kind, photo: photo() }, now);
  }

  it('pemilik tidak diabsen; hak awal; pengaturan tertanam', async () => {
    const owner = await actorOf(ids.owner);
    expect(await check.attendanceScreen(owner, at('09:00'))).toEqual({ tracked: false });
    expect(await check.tracksAttendance(owner, day)).toBe(false);
    expect(await check.tracksAttendance(await actorOf(ids.ani), day)).toBe(true);
    expect((await actorOf(ids.head)).grants.get('attendance.photo.view')).toBe('BRANCH');
    expect((await actorOf(ids.ani)).grants.has('attendance.photo.view')).toBe(false);
  });

  it('tanpa lokasi ditolak dan percobaan tercatat (syarat owner, no 29)', async () => {
    const result = await check.checkLocation(await actorOf(ids.dedi), { code: codePusat, kind: 'IN', latitude: null, longitude: null, accuracy: null }, at('08:00'));
    expect(result).toMatchObject({ ok: false, status: 400 });
    const rows = await sql`select result from hris.attendance_attempts where employee_id = ${ids.dedi}`;
    expect(rows.map((row) => row.result)).toEqual(['NO_LOCATION']);
  });

  it('masuk terlalu pagi ditolak; telat tersimpan dibulatkan ke bawah; tekan dua kali tercatat sekali', async () => {
    expect(await check.scanQr(await actorOf(ids.dedi), { code: codePusat, kind: 'IN' }, at('05:59'))).toMatchObject({ ok: false, status: 409 });
    const now = new Date(at('08:05').getTime() + 40_000);
    expect(await fullCheck(ids.dedi, 'IN', now)).toMatchObject({ ok: true });
    expect(await fullCheck(ids.dedi, 'IN', new Date(now.getTime() + 5_000))).toMatchObject({ ok: true });
    const records = await sql`select r.kind, r.needs_review, d.late_minutes from hris.attendance_records r join hris.attendance_days d on d.id = r.day_id where d.employee_id = ${ids.dedi}`;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'IN', needs_review: false, late_minutes: 5 });
  });

  it('pulang paling cepat 15 menit; cepat pulang tersimpan; catatan tidak bisa diubah atau dihapus', async () => {
    expect(await fullCheck(ids.dedi, 'OUT', at('08:10'))).toMatchObject({ ok: false, status: 409 });
    expect(await fullCheck(ids.dedi, 'OUT', at('16:30'))).toMatchObject({ ok: true });
    const [row] = await sql`select early_leave_minutes from hris.attendance_days where employee_id = ${ids.dedi}`;
    expect(row.early_leave_minutes).toBe(30);
    await expect(sql`update hris.attendance_records set needs_review = true`).rejects.toThrow();
    await expect(sql`delete from hris.attendance_records`).rejects.toThrow();
    await expect(sql`delete from hris.attendance_days`).rejects.toThrow();
    await expect(sql`update hris.attendance_days set late_minutes = 0 where employee_id = ${ids.dedi}`).rejects.toThrow();
    const screen = await check.attendanceScreen(await actorOf(ids.dedi), at('16:40'));
    expect(screen).toMatchObject({ tracked: true, state: { status: 'OUT', buttons: [] } });
  });

  it('di luar radius tetap tercatat bertanda; QR mati ditolak', async () => {
    expect(await fullCheck(ids.eka, 'IN', at('08:00'), codePusat, FAR)).toMatchObject({ ok: true });
    const [row] = await sql`select r.needs_review, r.distance_m from hris.attendance_records r join hris.attendance_days d on d.id = r.day_id where d.employee_id = ${ids.eka}`;
    expect(row.needs_review).toBe(true);
    expect(row.distance_m).toBeGreaterThan(100);
  });

  it('perbantuan: salah scan tercatat tanpa absen; shift dipilih sendiri; pulang QR lain ditolak', async () => {
    const actor = await actorOf(ids.fani);
    const scan = await check.scanQr(actor, { code: codeDepan, kind: 'IN' }, at('12:00'));
    expect(scan).toMatchObject({ ok: true, data: { needsAssist: true, matchedShift: null } });
    expect(await check.reportWrongScan(actor, codeDepan, at('12:00'))).toMatchObject({ ok: true });
    expect(await check.checkLocation(actor, { code: codeDepan, kind: 'IN', ...POINT }, at('12:00'))).toMatchObject({ ok: false, status: 409 });
    const shiftId = scan.ok ? scan.data.shiftOptions[0].id : 0;
    expect(await fullCheck(ids.fani, 'IN', at('13:10'), codeDepan, POINT, { assist: true, shiftId })).toMatchObject({ ok: true });
    const [dayRow] = await sql`select late_minutes, shift_source, branch_id from hris.attendance_days where employee_id = ${ids.fani}`;
    expect(dayRow).toMatchObject({ late_minutes: 10, shift_source: 'ASSIST_CHOSEN', branch_id: depan });
    const answers = await sql`select answer, shift_chosen from hris.branch_assists where employee_id = ${ids.fani} order by id`;
    expect(answers.map((row) => row.answer)).toEqual(['WRONG_SCAN', 'ASSIST']);
    expect(answers[1].shift_chosen).toBe(true);
    expect(await check.scanQr(actor, { code: codePusat, kind: 'OUT' }, at('20:00'))).toMatchObject({ ok: false, status: 409 });
    const list = await check.assistsScreen(await actorOf(ids.foreignHead), null, 7, at('20:00'));
    expect(list.rows.map((row) => row.name)).toEqual(['Fani']);
    expect((await check.assistsScreen(await actorOf(ids.head), null, 7, at('20:00'))).rows).toEqual([]);
  });

  it('penjaga: satu-satunya kasir ditolak; teman istirahat ditolak dengan nama; bukan penjaga bebas', async () => {
    expect(await fullCheck(ids.ani, 'IN', at('08:00'))).toMatchObject({ ok: true });
    expect(await check.startBreak(await actorOf(ids.ani), POINT, at('12:00'))).toMatchObject({ ok: true, data: { alone: true } });
    const [alone] = await sql`select alone_no_break from hris.attendance_days where employee_id = ${ids.ani}`;
    expect(alone.alone_no_break).toBe(true);

    expect(await fullCheck(ids.budi, 'IN', at('08:00'))).toMatchObject({ ok: true });
    expect(await check.startBreak(await actorOf(ids.ani), POINT, at('12:01'))).toMatchObject({ ok: true });
    const denied = await check.startBreak(await actorOf(ids.budi), POINT, at('12:02'));
    expect(denied).toMatchObject({ ok: false, status: 409 });
    expect(!denied.ok && denied.error).toContain('Ani');
    expect(!denied.ok && denied.error).toContain('13.01');

    expect(await check.startBreak(await actorOf(ids.eka), { latitude: null, longitude: null, accuracy: null }, at('12:03'))).toMatchObject({ ok: true });
  });

  it('dua kasir terakhir menekan bersamaan: hanya satu yang lolos (no 26)', async () => {
    expect(await fullCheck(ids.hana, 'IN', at('13:00'), codeDepan)).toMatchObject({ ok: true });
    expect(await fullCheck(ids.ina, 'IN', at('13:00'), codeDepan)).toMatchObject({ ok: true });
    const results = await Promise.all([
      check.startBreak(await actorOf(ids.hana), POINT, at('14:00')),
      check.startBreak(await actorOf(ids.ina), POINT, at('14:00')),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const on = await sql`select count(*)::int as n from hris.attendance_records r join hris.attendance_days d on d.id = r.day_id where r.kind = 'BREAK' and d.branch_id = ${depan}`;
    expect(on[0].n).toBe(1);
  });

  it('kembali dari istirahat tanpa telat: lewat batas nol', async () => {
    expect(await fullCheck(ids.ani, 'RETURN', at('13:00'))).toMatchObject({ ok: true });
    expect(await check.startBreak(await actorOf(ids.budi), POINT, at('13:30'))).toMatchObject({ ok: true });
  });

  it('masuk kembali: lewat batas dihitung sekali; pulang saat istirahat ditolak', async () => {
    const [before] = await sql`select break_over_minutes from hris.attendance_days where employee_id = ${ids.ani}`;
    expect(before.break_over_minutes).toBe(0);
    expect(await fullCheck(ids.budi, 'OUT', at('14:00'))).toMatchObject({ ok: false, status: 409 });
    expect(await fullCheck(ids.budi, 'RETURN', at('14:50'))).toMatchObject({ ok: true });
    const [row] = await sql`select break_over_minutes from hris.attendance_days where employee_id = ${ids.budi}`;
    expect(row.break_over_minutes).toBe(20);
  });

  it('hari kerja: pulang sebelum 04.00 masuk kemarin, sesudahnya hari baru', async () => {
    const tomorrow = addDays(day, 1);
    const early = await check.attendanceScreen(await actorOf(ids.ani), at('03:00', tomorrow));
    expect(early).toMatchObject({ tracked: true, workDate: day });
    const late = await check.attendanceScreen(await actorOf(ids.ani), at('04:10', tomorrow));
    expect(late).toMatchObject({ tracked: true, workDate: tomorrow, state: { status: 'TOO_EARLY' } });
  });

  it('foto: hak per cabang, pembukaan dicatat; penghapus menyisakan jam dan aman diulang', async () => {
    const [{ id }] = await sql`select r.id from hris.attendance_records r join hris.attendance_days d on d.id = r.day_id where d.employee_id = ${ids.ani} and r.kind = 'IN'`;
    expect(await check.openAttendancePhoto(await actorOf(ids.budi), id)).toBeNull();
    expect(await check.openAttendancePhoto(await actorOf(ids.foreignHead), id)).toBeNull();
    const fileId = await check.openAttendancePhoto(await actorOf(ids.head), id);
    expect(fileId).toBeTruthy();
    const views = await sql`select count(*)::int as n from hris.attendance_photo_views where record_id = ${id}`;
    expect(views[0].n).toBe(1);
    const screen = await check.photosScreen(await actorOf(ids.head), null, at('15:00'));
    expect(screen.rows.some((row) => row.id === id && row.available)).toBe(true);

    expect((await check.purgeAttendancePhotos(at('12:00', addDays(day, 30)))).purged).toBe(0);
    const later = at('12:00', addDays(day, 62));
    expect((await check.purgeAttendancePhotos(later)).purged).toBeGreaterThan(0);
    expect((await check.purgeAttendancePhotos(later)).purged).toBe(0);
    expect(await check.openAttendancePhoto(await actorOf(ids.head), id)).toBeNull();
    const [kept] = await sql`select recorded_at from hris.attendance_records where id = ${id}`;
    expect(kept.recorded_at).toBeTruthy();
  });

  it('QR dibuat ulang: kode lama langsung mati', async () => {
    const result = await write.regenerateQr(await actorOf(ids.hr), pusat);
    expect(result).toMatchObject({ ok: true });
    expect(await check.scanQr(await actorOf(ids.gudang), { code: codePusat, kind: 'IN' }, at('08:00'))).toMatchObject({ ok: false, status: 400 });
  });
});
