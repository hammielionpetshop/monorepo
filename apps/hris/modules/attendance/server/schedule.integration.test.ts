import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import { addDays, mondayOf } from '../rules/schedule';

// Alur Jam Kerja & Jadwal (spec L3a §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_schedule_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';

let admin: postgres.Sql;
let sql: postgres.Sql;
let write: typeof import('./write');
let read: typeof import('./read');
let actorOf: (employeeId: number) => Promise<Actor>;
let today: string;
let week: string;
let branch: number;
let other: number;
let ids: Record<'owner' | 'hr' | 'head' | 'ani' | 'budi' | 'driver' | 'foreignHead', number>;

const hours = { startTime: '08:00', endTime: '16:00', breakMinutes: null, breakStartFrom: null, breakStartUntil: null };

describe.skipIf(!ADMIN_URL)('L3a: Jam Kerja & Jadwal', () => {
  beforeAll(async () => {
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
    const files = readdirSync(folder).filter((file) => file.endsWith('.sql')).sort();
    // Cabang dibuat sebelum 0008 supaya isi awal titik bisa diuji.
    for (const file of files.filter((name) => name < '0008')) await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
    [{ id: branch }] = await sql`insert into hris.branches (name) values ('Toko Pusat') returning id`;
    [{ id: other }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Depan', 1, 2) returning id`;
    await sql`insert into hris.branches (name) values ('Toko Cikarang')`;
    for (const file of files.filter((name) => name >= '0008')) await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();

    const person = async (name: string, position: string, branchId = branch) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branchId}, ${pos.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Pemilik', 'Pemilik'), hr: await person('Nadia HR', 'HR'), head: await person('Kepala Pusat', 'Kepala Toko'),
      ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir'), driver: await person('Dodi', 'Driver'),
      foreignHead: await person('Kepala Depan', 'Kepala Toko', other),
    };
    process.env.DATABASE_URL = url.toString();
    write = await import('./write');
    read = await import('./read');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const { todayWib } = await import('@/modules/employees');
    today = todayWib();
    week = mondayOf(today);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const addShift = async (name: string, startTime: string, endTime: string) => {
    const result = await write.saveShiftVersion(await actorOf(ids.hr), {
      ...hours, branchId: branch, name, startTime, endTime, effectiveFrom: today, effectiveUntil: null, reason: REASON,
    });
    if (!result.ok) throw new Error(result.error);
    return result.data.shiftId;
  };

  it('migrasi: titik hanya mengisi yang kosong; cara absen Pemilik/Driver/Kasir; hak awal', async () => {
    const rows = await sql`select name, latitude from hris.branches order by id`;
    expect(rows.map((row) => row.latitude)).toEqual([-7.350564720030627, 1, null]);
    const roster = await read.rosterOn(today);
    const mode = (id: number) => roster.find((row) => row.employeeId === id)?.mode;
    expect([mode(ids.owner), mode(ids.driver), mode(ids.ani)]).toEqual(['NONE', 'TRIP', 'QR']);
    expect((await actorOf(ids.head)).grants.get('attendance.schedule.update')).toBe('BRANCH');
    expect((await actorOf(ids.ani)).grants.has('attendance.schedule.view')).toBe(false);
  });

  it('jam kerja: kasir ditolak; shift baru boleh hari ini; versi berikutnya paling cepat besok', async () => {
    const denied = await write.saveShiftVersion(await actorOf(ids.ani), {
      ...hours, branchId: branch, name: 'X', effectiveFrom: today, effectiveUntil: null, reason: REASON,
    });
    expect(denied).toMatchObject({ ok: false, status: 403 });
    const pagi = await addShift('Pagi', '08:00', '16:00');
    const again = await write.saveShiftVersion(await actorOf(ids.hr), {
      ...hours, branchId: branch, shiftId: pagi, effectiveFrom: today, effectiveUntil: null, reason: REASON,
    });
    expect(again).toMatchObject({ ok: false, status: 400 });
    expect(await write.saveShiftVersion(await actorOf(ids.hr), {
      ...hours, branchId: branch, shiftId: pagi, startTime: '09:00', effectiveFrom: addDays(today, 1), effectiveUntil: null, reason: REASON,
    })).toMatchObject({ ok: true });
  });

  it('kelompok + mesin: giliran awal sekali, mesin diulang tetap satu baris, minggu depan tertukar, lingkup cabang dijaga', async () => {
    const siang = await addShift('Siang', '13:00', '21:00');
    expect(await write.saveInitialGroups(await actorOf(ids.foreignHead), branch, [[ids.ani], [ids.budi]])).toMatchObject({ ok: false, status: 403 });
    expect(await write.saveInitialGroups(await actorOf(ids.head), branch, [[ids.ani], [ids.budi]])).toMatchObject({ ok: true });
    expect(await write.saveInitialGroups(await actorOf(ids.head), branch, [[ids.ani], [ids.budi]])).toMatchObject({ ok: false, status: 409 });

    const nextWeek = addDays(week, 7);
    await write.rotateShifts(addDays(nextWeek, 2)); // mesin mati Senin, hidup Rabu
    await write.rotateShifts(addDays(nextWeek, 2));
    const rows = await sql`select employee_id, shift_id from hris.shift_assignments where week_start = ${nextWeek} order by employee_id`;
    expect(rows.map((row) => Number(row.employee_id))).toEqual([ids.ani, ids.budi]);
    expect(Number(rows[0].shift_id)).toBe(siang);
    expect(Number(rows[1].shift_id)).not.toBe(siang);

    const blocked = await write.setShiftActive(await actorOf(ids.hr), siang, false, REASON);
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    if (!blocked.ok) expect(blocked.error).toMatch(/Budi|Ani/);
  });

  it('ubah per hari: alasan wajib, orangnya diberi tahu, jadwal sendiri ditolak, nilai lama tercatat', async () => {
    const date = addDays(week, 14);
    const [shifts, head] = [await read.loadShifts([branch]), await actorOf(ids.head)];
    const target = shifts[1].id;
    expect(await write.changeDayShift(head, ids.head, date, target, REASON)).toMatchObject({ ok: false, status: 403 });
    expect(await write.changeDayShift(head, ids.ani, date, target, 'x')).toMatchObject({ ok: false, status: 400 });
    expect(await write.changeDayShift(head, ids.ani, date, target, REASON)).toMatchObject({ ok: true });
    const data = await read.buildBranchWeek(branch, mondayOf(date), [{ employeeId: ids.ani, name: 'Ani' }]);
    expect(data.rows[0].cells.find((cell) => cell.date === date)).toMatchObject({ shiftId: target, source: 'DAY_CHANGE' });
    const inbox = await sql`select kind from hris.notifications where recipient_account_id = ${ids.ani + 1000} and kind = 'attendance.shift'`;
    expect(inbox.length).toBe(1);
  });

  it('QR: satu aktif, yang lama mati; radius belum bisa diubah HR lewat QR; status terbaca', async () => {
    const hr = await actorOf(ids.hr);
    const first = await write.regenerateQr(hr, branch);
    const second = await write.regenerateQr(hr, branch);
    if (!first.ok || !second.ok) throw new Error('QR gagal');
    expect(await read.qrStatus(first.data.code)).toBe('DEAD');
    expect(await read.qrStatus(second.data.code)).toBe('ALIVE');
    expect(await read.qrStatus('tidak-ada')).toBe('UNKNOWN');
    expect(await write.regenerateQr(await actorOf(ids.ani), branch)).toMatchObject({ ok: false, status: 403 });
    await expect(sql`insert into hris.branch_qr_codes (branch_id, code, created_by_account_id) values (${branch}, 'kembar', 1)`).rejects.toThrow();
  });

  it('hari tutup: mundur tertandai, tumpukan ditolak, batal tetap tersimpan, jadwal menampilkannya', async () => {
    const hr = await actorOf(ids.hr);
    const added = await write.addClosure(hr, { branchId: null, startDate: addDays(today, -1), endDate: addDays(today, -1), reason: REASON });
    if (!added.ok) throw new Error(added.error);
    const [row] = await sql`select backdated from hris.branch_closures where id = ${added.data.id}`;
    expect(row.backdated).toBe(true);
    expect(await write.addClosure(hr, { branchId: branch, startDate: addDays(today, -1), endDate: addDays(today, -1), reason: REASON })).toMatchObject({ ok: false, status: 409 });
    expect(await write.cancelClosure(hr, added.data.id, REASON)).toMatchObject({ ok: true });
    const future = addDays(today, 30);
    expect(await write.addClosure(hr, { branchId: branch, startDate: future, endDate: future, reason: REASON })).toMatchObject({ ok: true });
    const data = await read.buildBranchWeek(branch, mondayOf(future), [{ employeeId: ids.ani, name: 'Ani' }]);
    expect(data.rows[0].cells.find((cell) => cell.date === future)?.closed).toBe(true);
  });

  it('pagar DB: baris tidak bisa dihapus; pemeriksa giliran paling banyak sekali per minggu', async () => {
    await expect(sql`delete from hris.work_shifts`).rejects.toThrow();
    await expect(sql`delete from hris.branch_closures`).rejects.toThrow();
    await expect(sql`update hris.shift_day_changes set reason = 'ubah paksa'`).rejects.toThrow();
    const [{ id: third }] = await sql`select id from hris.branches where name = 'Toko Depan'`;
    const hr = await actorOf(ids.hr);
    for (const name of ['P', 'S']) {
      await write.saveShiftVersion(hr, { ...hours, branchId: Number(third), name, effectiveFrom: today, effectiveUntil: null, reason: REASON });
    }
    const first = await write.checkShifts(today);
    const second = await write.checkShifts(today);
    expect(first.warned).toBeGreaterThan(0);
    expect(second.warned).toBe(0);
    const inbox = await sql`select title from hris.notifications where kind = 'attendance.shift_check' and recipient_account_id = ${ids.foreignHead + 1000}`;
    expect(inbox.length).toBe(1);
  });
});
