import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import { wibInstant } from '../rules/attendance';
import { periodStartOf } from '../rules/days-off';
import { shiftPeriod } from '../rules/review';
import { addDays } from '../rules/schedule';

// Libur dan Tukar (spec L3e §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_days_off_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';
const POINT = { latitude: -7.350564720030627, longitude: 108.10865608125447, accuracy: 12 };
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1])], 'absen.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let check: typeof import('./check');
let daysOff: typeof import('./days-off');
let actorOf: (employeeId: number) => Promise<Actor>;
let pusat: number;
let depan: number;
let codePusat: string;
/** Periode dua bulan ke depan dari hari ini sungguhan: selalu sesudah DAY_OFF_MARKS_FROM dan jendelanya belum lewat. */
let P: string;
let month: (day: number) => string;
let realToday: string;
let ids: Record<'owner' | 'hr' | 'head' | 'foreignHead' | 'ani' | 'dedi' | 'eka' | 'fani' | 'gina' | 'hana', number>;

describe.skipIf(!ADMIN_URL)('L3e: Libur dan Tukar', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(tmpdir(), `hris-libur-${process.pid}`);
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
    // HR di cabang lain supaya hitungan Toko Pusat jelas: 5 orang berjatah (Kepala + 4), batas 2.
    ids = {
      owner: await person('Pemilik', 'Pemilik'), hr: await person('Nadia HR', 'HR', depan),
      head: await person('Kepala Pusat', 'Kepala Toko'), foreignHead: await person('Kepala Depan', 'Kepala Toko', depan),
      ani: await person('Ani', 'Kasir'), dedi: await person('Dedi', 'Pramuniaga'), eka: await person('Eka', 'Pramuniaga'),
      fani: await person('Fani', 'Pramuniaga'), gina: await person('Gina', 'Kasir', depan), hana: await person('Hana', 'Kasir', depan),
    };
    process.env.DATABASE_URL = url.toString();
    check = await import('./check');
    daysOff = await import('./days-off');
    const write = await import('./write');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const { todayWib } = await import('@/modules/employees');
    realToday = todayWib();
    P = shiftPeriod(periodStartOf(realToday), 2);
    month = (day) => `${P.slice(0, 8)}${String(day).padStart(2, '0')}`;
    // Tanggal uji bergantung pada hari ini sungguhan, jadi batas akhir pekan dilonggarkan (aturannya dites di unit).
    await sql`insert into hris.setting_values (key, value, effective_from, status, reason)
      values ('attendance.day_off_weekend_max', '10'::jsonb, '2026-01-02', 'ACTIVE', 'Uji: akhir pekan dites di unit')`;
    const qr = await write.regenerateQr(await actorOf(ids.hr), pusat);
    if (!qr.ok) throw new Error(qr.error);
    codePusat = qr.data.code;
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const inWindow = () => wibInstant(month(12), '10:00');
  const save = async (employeeId: number, dates: string[], now = inWindow(), periodStart = P) => (
    daysOff.saveMyDaysOff(await actorOf(employeeId), { periodStart, dates }, now)
  );
  const pickId = async (employeeId: number, date: string) => (await sql`
    select id from hris.day_off_picks where employee_id = ${employeeId} and off_date = ${date} and status = 'ACTIVE'`)[0]?.id as number | undefined;
  const nextP = (offset: number) => addDays(P, offset);

  it('hak awal tertanam: HR mencabut semua cabang, Kepala Toko mengubah cabangnya tanpa mencabut', async () => {
    const hr = await actorOf(ids.hr);
    const head = await actorOf(ids.head);
    expect(hr.grants.get('attendance.dayoff.revoke')).toBe('ALL');
    expect(head.grants.get('attendance.dayoff.change')).toBe('BRANCH');
    expect(head.grants.has('attendance.dayoff.revoke')).toBe(false);
    expect((await actorOf(ids.ani)).grants.has('attendance.dayoff.view')).toBe(false);
    // Pemilik tidak diabsen, jadi tidak punya jatah (H42).
    expect(await daysOff.myDaysOffScreen(await actorOf(ids.owner), null, inWindow())).toEqual({ tracked: false });
  });

  it('pilih libur di jendela: simpan sebagian, yang melanggar jarak disebut, sisanya tersimpan; lepas pilihan = Diganti', async () => {
    const result = await save(ids.ani, [nextP(1), nextP(3), nextP(9), nextP(15), nextP(21)]);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.data.accepted).toHaveLength(4);
    expect(result.data.rejected).toEqual([{ date: nextP(3), reason: 'Terlalu dekat dengan libur lain' }]);
    const moved = await save(ids.ani, [nextP(1), nextP(9), nextP(15), nextP(22)]);
    expect(moved).toMatchObject({ ok: true, data: { released: [nextP(21)], accepted: [nextP(22)] } });
    const [{ status }] = await sql`select status from hris.day_off_picks where employee_id = ${ids.ani} and off_date = ${nextP(21)}`;
    expect(status).toBe('REPLACED');
    // Menyimpan atas nama orang lain tidak mungkin: pintunya hanya untuk dirinya (H43).
    expect(await daysOff.saveMyDaysOff(await actorOf(ids.owner), { periodStart: P, dates: [nextP(2)] }, inWindow())).toMatchObject({ ok: false, status: 403 });
  });

  it('batas cabang KEH-34: tanggal penuh ditolak, dua simpan bersamaan untuk satu slot hanya satu yang lolos', async () => {
    const date = nextP(5);
    expect(await save(ids.dedi, [date])).toMatchObject({ ok: true, data: { accepted: [date] } });
    const [a, b] = await Promise.all([save(ids.eka, [date]), save(ids.fani, [date])]);
    const accepted = [a, b].filter((row) => row.ok && row.data.accepted.length === 1);
    expect(accepted).toHaveLength(1);
    const rows = await sql`select count(*)::int as n from hris.day_off_picks where off_date = ${date} and status = 'ACTIVE'`;
    expect(rows[0].n).toBe(2);
    const loser = [a, b].find((row) => row.ok && row.data.rejected.length === 1);
    expect(loser).toMatchObject({ data: { rejected: [{ date, reason: 'Penuh' }] } });
  });

  it('sesudah jendela tutup: tidak bisa melepas, tanggal terlalu dekat ditolak, jalur terlambat bertanda LATE', async () => {
    const late = wibInstant(nextP(1), '09:00');
    const current = (await sql`select off_date::text as d from hris.day_off_picks where employee_id = ${ids.ani} and status = 'ACTIVE' and period_start = ${P}`)
      .map((row) => String(row.d));
    expect(await save(ids.ani, current.slice(1), late)).toMatchObject({ ok: false, status: 409 });
    const faniHas = (await sql`select off_date::text as d from hris.day_off_picks where employee_id = ${ids.fani} and status = 'ACTIVE' and period_start = ${P}`)
      .map((row) => String(row.d));
    const fani = await save(ids.fani, [...faniHas, nextP(2), nextP(12)], late);
    expect(fani).toMatchObject({ ok: true, data: { accepted: [nextP(12)], rejected: [{ date: nextP(2), reason: 'Terlalu dekat dari hari ini' }] } });
    const [{ origin }] = await sql`select origin from hris.day_off_picks where employee_id = ${ids.fani} and off_date = ${nextP(12)}`;
    expect(origin).toBe('LATE');
  });

  it('mesin harian: satu tanda tidak memilih per orang per periode; diulang tetap satu', async () => {
    const run = wibInstant(nextP(1), '00:10');
    await daysOff.runDaysOffDaily(run);
    await daysOff.runDaysOffDaily(run);
    const marks = await sql`select employee_id from hris.day_off_missing_marks where period_start = ${P}`;
    const marked = new Set(marks.map((row) => Number(row.employee_id)));
    expect(marked.has(ids.ani)).toBe(false);
    expect(marked.has(ids.dedi)).toBe(true);
    expect(marks.length).toBe(marked.size);
    await expect(sql`delete from hris.day_off_missing_marks`).rejects.toThrow();
  });

  it('tukar libur: hanya teman yang diajak menjawab; diterima = dua jadwal berubah; jadwal berubah = ajakan tidak berlaku', async () => {
    const now = wibInstant(month(20), '10:00');
    const options = await daysOff.swapOptions(await actorOf(ids.ani), { kind: 'DAY_OFF', date: nextP(1) }, now);
    expect(options).toMatchObject({ ok: true });
    if (!options.ok) return;
    expect(options.data.options.find((row) => row.employeeId === ids.dedi)?.dates.map((row) => row.date)).toEqual([nextP(5)]);
    expect(options.data.options.some((row) => row.employeeId === ids.gina)).toBe(false); // cabang lain (H47)
    const sent = await daysOff.sendSwap(await actorOf(ids.ani), { kind: 'DAY_OFF', date: nextP(1), friendId: ids.dedi, friendDate: nextP(5) }, now);
    expect(sent).toMatchObject({ ok: true });
    if (!sent.ok) return;
    expect(await daysOff.answerSwap(await actorOf(ids.head), { id: sent.data.id, accept: true }, now)).toMatchObject({ ok: false, status: 404 }); // H49
    expect(await daysOff.answerSwap(await actorOf(ids.dedi), { id: sent.data.id, accept: true }, now)).toMatchObject({ ok: true });
    expect(await pickId(ids.ani, nextP(5))).toBeDefined();
    expect(await pickId(ids.dedi, nextP(1))).toBeDefined();
    expect(await pickId(ids.ani, nextP(1))).toBeUndefined();
    await expect(sql`update hris.swap_invitations set status = 'PENDING', answered_at = null where id = ${sent.data.id}`).rejects.toThrow();

    // Ajakan kedua; libur pengaju lalu digeser kepala cabang sebelum dijawab.
    const second = await daysOff.sendSwap(await actorOf(ids.ani), { kind: 'DAY_OFF', date: nextP(9), friendId: ids.dedi, friendDate: nextP(1) }, now);
    expect(second).toMatchObject({ ok: true });
    if (!second.ok) return;
    expect(await daysOff.changeDayOff(await actorOf(ids.head), { pickId: (await pickId(ids.ani, nextP(9)))!, date: nextP(10), reason: REASON }, now))
      .toMatchObject({ ok: true });
    expect(await daysOff.answerSwap(await actorOf(ids.dedi), { id: second.data.id, accept: true }, now))
      .toMatchObject({ ok: false, status: 409, error: 'Jadwal sudah berubah, ajakan ini tidak berlaku lagi.' });
  });

  it('ajakan lewat batas batal otomatis dan pengaju diberi tahu', async () => {
    const [mine] = await sql`select id from hris.day_off_picks where employee_id = ${ids.ani} and off_date = ${nextP(15)} and status = 'ACTIVE'`;
    const [theirs] = await sql`select id from hris.day_off_picks where employee_id = ${ids.dedi} and off_date = ${nextP(1)} and status = 'ACTIVE'`;
    await sql`insert into hris.swap_invitations (kind, branch_id, from_employee_id, to_employee_id, from_date, to_date, from_pick_id, to_pick_id, answer_by)
      values ('DAY_OFF', ${pusat}, ${ids.ani}, ${ids.dedi}, ${nextP(15)}, ${nextP(1)}, ${mine.id}, ${theirs.id}, ${addDays(P, -2)})`;
    const result = await daysOff.runDaysOffDaily(wibInstant(addDays(P, -1), '00:10'));
    expect(result.expiredSwaps).toBe(1);
    const notes = await sql`select count(*)::int as n from hris.notifications where kind = 'attendance.swap' and recipient_account_id = ${ids.ani + 1000} and title like '%batal%'`;
    expect(notes[0].n).toBe(1);
  });

  it('ubah langsung dan cabut: lingkup cabang, cabut hanya HR/Pemilik, tidak atas diri sendiri', async () => {
    const now = wibInstant(month(20), '10:00');
    const target = (await pickId(ids.ani, nextP(15)))!;
    expect(await daysOff.changeDayOff(await actorOf(ids.foreignHead), { pickId: target, date: nextP(16), reason: REASON }, now)).toMatchObject({ ok: false, status: 403 }); // H45
    expect(await daysOff.revokeDayOff(await actorOf(ids.head), { pickId: target, reason: REASON }, now)).toMatchObject({ ok: false, status: 403 }); // H44
    expect(await daysOff.revokeDayOff(await actorOf(ids.hr), { pickId: target, reason: REASON }, now)).toMatchObject({ ok: true });
    const [{ status }] = await sql`select status from hris.day_off_picks where id = ${target}`;
    expect(status).toBe('REVOKED');
    await expect(sql`update hris.day_off_picks set status = 'ACTIVE', ended_at = null where id = ${target}`).rejects.toThrow();
    await expect(sql`delete from hris.day_off_picks where id = ${target}`).rejects.toThrow();
    const headPick = await save(ids.head, [nextP(25)]);
    expect(headPick).toMatchObject({ ok: true });
    expect(await daysOff.changeDayOff(await actorOf(ids.head), { pickId: (await pickId(ids.head, nextP(25)))!, date: nextP(26), reason: REASON }, now))
      .toMatchObject({ ok: false, status: 403 });
  });

  it('diminta masuk: karyawan tidak bisa meminta; Siap masuk; Masuk terbuka; pengganti lahir saat absen dan dipilih', async () => {
    // Tanggal lampau supaya langkah lokasi (jam server sungguhan) mendahului jam uji.
    const day = addDays(realToday, -3);
    const period = periodStartOf(day);
    const [dedi] = await sql`insert into hris.day_off_picks (employee_id, period_start, off_date, origin, created_by_account_id)
      values (${ids.dedi}, ${period}, ${day}, 'PICK', 1) returning id`;
    await sql`insert into hris.day_off_picks (employee_id, period_start, off_date, origin, created_by_account_id)
      values (${ids.eka}, ${period}, ${day}, 'PICK', 1)`;
    const morning = wibInstant(day, '06:00');
    expect(await daysOff.createWorkRequest(await actorOf(ids.ani), { pickId: dedi.id, reason: REASON }, morning)).toMatchObject({ ok: false, status: 403 }); // H50
    expect(await daysOff.createWorkRequest(await actorOf(ids.foreignHead), { pickId: dedi.id, reason: REASON }, morning)).toMatchObject({ ok: false, status: 403 }); // H51
    const request = await daysOff.createWorkRequest(await actorOf(ids.head), { pickId: dedi.id, reason: REASON }, morning);
    expect(request).toMatchObject({ ok: true });
    if (!request.ok) return;
    expect(await daysOff.createWorkRequest(await actorOf(ids.head), { pickId: dedi.id, reason: REASON }, morning)).toMatchObject({ ok: false, status: 409 });
    expect(await daysOff.readyToWork(await actorOf(ids.dedi), request.data.id, morning)).toMatchObject({ ok: true });

    const fullCheck = async (employeeId: number, now: Date) => {
      const actor = await actorOf(employeeId);
      const located = await check.checkLocation(actor, { code: codePusat, kind: 'IN', ...POINT }, now);
      if (!located.ok) return located;
      return check.submitAttendance(actor, { attemptId: located.data.attemptId, kind: 'IN', photo: photo() }, now);
    };
    const eight = wibInstant(day, '08:00');
    expect(await fullCheck(ids.eka, eight)).toMatchObject({ ok: false, status: 409, error: 'Hari ini jadwal libur Anda.' });
    expect((await check.attendanceScreen(await actorOf(ids.eka), eight))).toMatchObject({ state: { status: 'DAY_OFF' } });
    expect(await fullCheck(ids.dedi, eight)).toMatchObject({ ok: true });
    const [replacement] = await sql`select id, status, choose_by::text as choose_by from hris.replacement_days_off where work_request_id = ${request.data.id}`;
    expect(replacement.status).toBe('WAITING');
    expect(replacement.choose_by).toBe(addDays(day, 14));
    expect(await daysOff.cancelWorkRequest(await actorOf(ids.head), { id: request.data.id, reason: REASON }, morning)).toMatchObject({ ok: false, status: 409 });
    const chosen = await daysOff.chooseReplacement(await actorOf(ids.dedi), { id: replacement.id, date: addDays(day, 2) }, wibInstant(day, '18:00'));
    expect(chosen).toMatchObject({ ok: true });
    const [{ origin }] = await sql`select origin from hris.day_off_picks where replacement_id = ${replacement.id} and status = 'ACTIVE'`;
    expect(origin).toBe('REPLACEMENT');
    expect(await daysOff.chooseReplacement(await actorOf(ids.dedi), { id: replacement.id, date: addDays(day, 20) }, wibInstant(day, '18:00')))
      .toMatchObject({ ok: false, status: 400 });
  });

  it('libur pengganti yang tidak dipilih sampai batas hangus', async () => {
    const day = addDays(realToday, -40);
    const [pick] = await sql`insert into hris.day_off_picks (employee_id, period_start, off_date, origin, created_by_account_id)
      values (${ids.fani}, ${periodStartOf(day)}, ${day}, 'PICK', 1) returning id`;
    const [request] = await sql`insert into hris.day_off_work_requests (employee_id, pick_id, work_date, requested_by_account_id, requested_by_employee_id, reason, status)
      values (${ids.fani}, ${pick.id}, ${day}, ${ids.head + 1000}, ${ids.head}, ${REASON}, 'READY') returning id`;
    await sql`insert into hris.replacement_days_off (work_request_id, employee_id, work_date, choose_by) values (${request.id}, ${ids.fani}, ${day}, ${addDays(day, 14)})`;
    const result = await daysOff.runDaysOffDaily(wibInstant(addDays(day, 15), '00:10'));
    expect(result.expiredReplacements).toBe(1);
  });

  it('Libur Cabang: karyawan tidak melihat daftar belum memilih; kepala cabang hanya cabangnya', async () => {
    const view = await daysOff.branchDaysOffScreen(await actorOf(ids.ani), { branchId: null, periodStart: P }, inWindow());
    expect(view.missing).toEqual([]); // H52
    const head = await daysOff.branchDaysOffScreen(await actorOf(ids.head), { branchId: depan, periodStart: P }, inWindow());
    expect(head.branchId).toBe(pusat);
    expect(head.missing.some((row) => row.employeeId === ids.dedi)).toBe(true);
    expect(head.canRevoke).toBe(false);
  });
});
