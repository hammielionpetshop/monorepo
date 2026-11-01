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

// Tinjau, Koreksi, dan Rekap (spec L3c §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_review_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';
const POINT = { latitude: -7.350564720030627, longitude: 108.10865608125447, accuracy: 12 };
const FAR = { latitude: -7.33, longitude: 108.2, accuracy: 30 };
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1])], 'absen.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let check: typeof import('./check');
let review: typeof import('./review');
let actorOf: (employeeId: number) => Promise<Actor>;
let day: string;
let tomorrow: Date;
let at: (time: string, date?: string) => Date;
let pusat: number;
let depan: number;
let codePusat: string;
let ids: Record<'owner' | 'hr' | 'adminHr' | 'finance' | 'head' | 'foreignHead' | 'ani' | 'dedi' | 'eka' | 'fani' | 'hana', number>;

describe.skipIf(!ADMIN_URL)('L3c: Tinjau, Koreksi, dan Rekap', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(tmpdir(), `hris-tinjau-${process.pid}`);
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
      owner: await person('Pemilik', 'Pemilik'), hr: await person('Nadia HR', 'HR'), adminHr: await person('Admin', 'Admin HR'),
      finance: await person('Fina', 'Finance'), head: await person('Kepala Pusat', 'Kepala Toko'),
      foreignHead: await person('Kepala Depan', 'Kepala Toko', depan),
      ani: await person('Ani', 'Kasir'), dedi: await person('Dedi', 'Pramuniaga'), eka: await person('Eka', 'Pramuniaga'),
      fani: await person('Fani', 'Pramuniaga'), hana: await person('Hana', 'Kasir', depan),
    };
    process.env.DATABASE_URL = url.toString();
    check = await import('./check');
    review = await import('./review');
    const write = await import('./write');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const { todayWib } = await import('@/modules/employees');
    // Semua kejadian di tanggal lampau: hasil langkah lokasi dicap jam server sungguhan, jadi jam uji tidak boleh di depannya.
    const today = todayWib();
    day = addDays(today, -3);
    at = (time, date = day) => wibInstant(date, time);
    tomorrow = at('09:00', addDays(day, 1));

    const hr = await actorOf(ids.hr);
    for (const [branchId, name] of [[pusat, 'Pagi'], [depan, 'Pagi']] as const) {
      const result = await write.saveShiftVersion(hr, {
        branchId, name, startTime: '08:00', endTime: '17:00', breakMinutes: 60, breakStartFrom: '11:00', breakStartUntil: '15:00',
        effectiveFrom: today, effectiveUntil: null, reason: REASON,
      });
      if (!result.ok) throw new Error(result.error);
    }
    // Jam yang sama berlaku mundur sejak `day` (data uji; layar tidak membolehkan jam mundur, KEH-02).
    await sql`insert into hris.work_shift_versions (shift_id, start_time, end_time, break_minutes, break_start_from, break_start_until,
        effective_from, effective_until, reason, created_by_account_id)
      select shift_id, start_time, end_time, break_minutes, break_start_from, break_start_until, ${day}, ${addDays(today, -1)}, reason, created_by_account_id
      from hris.work_shift_versions`;
    const qr = await write.regenerateQr(hr, pusat);
    if (!qr.ok) throw new Error(qr.error);
    codePusat = qr.data.code;

    // Dua hari sebelumnya tanpa shift (absen tetap boleh, tanpa hitungan telat) untuk pola luar titik.
    for (const date of [addDays(day, -2), addDays(day, -1)]) expect(await fullCheck(ids.eka, 'IN', at('08:00', date), FAR)).toMatchObject({ ok: true });
    expect(await fullCheck(ids.eka, 'IN', at('08:10'), FAR)).toMatchObject({ ok: true });
    expect(await fullCheck(ids.eka, 'OUT', at('17:00'))).toMatchObject({ ok: true });
    expect(await fullCheck(ids.fani, 'IN', at('08:00'), FAR)).toMatchObject({ ok: true });
    expect(await fullCheck(ids.ani, 'IN', at('08:20'))).toMatchObject({ ok: true });
    expect(await fullCheck(ids.ani, 'OUT', at('17:00'))).toMatchObject({ ok: true });
    expect(await fullCheck(ids.hr, 'IN', at('08:30'))).toMatchObject({ ok: true });
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  async function fullCheck(employeeId: number, kind: 'IN' | 'OUT', now: Date, point = POINT) {
    const actor = await actorOf(employeeId);
    const located = await check.checkLocation(actor, { code: codePusat, kind, ...point }, now);
    if (!located.ok) return located;
    return check.submitAttendance(actor, { attemptId: located.data.attemptId, kind, photo: photo() }, now);
  }

  const ekaRecordToday = async () => (await sql`
    select r.id from hris.attendance_records r join hris.attendance_days d on d.id = r.day_id
    where d.employee_id = ${ids.eka} and d.work_date = ${day} and r.kind = 'IN'`)[0].id as number;

  it('hak awal tertanam; Kehadiran Saya hanya untuk diri sendiri', async () => {
    expect((await actorOf(ids.head)).grants.get('attendance.review.view')).toBe('BRANCH');
    expect((await actorOf(ids.head)).grants.has('attendance.review.decide')).toBe(false);
    expect((await actorOf(ids.finance)).grants.get('attendance.correction.view')).toBe('ALL');
    expect((await actorOf(ids.ani)).grants.get('attendance.my_recap.view')).toBe('SELF');
    expect(await review.myAttendanceScreen(await actorOf(ids.owner), null, tomorrow)).toEqual({ tracked: false });
  });

  it('tinjau: kepala cabang hanya melihat; putusan alasan wajib, bentrok ditolak, bisa diganti; tabel hanya tambah', async () => {
    const recordId = await ekaRecordToday();
    const headView = await review.reviewScreen(await actorOf(ids.head), { tab: 'outside', filter: 'pending', branchId: null }, tomorrow);
    expect(headView.rows.find((row) => row.id === recordId)).toMatchObject({ canDecide: false, status: 'pending' });
    expect((await review.reviewScreen(await actorOf(ids.foreignHead), { tab: 'outside', filter: 'pending', branchId: null }, tomorrow)).rows).toEqual([]);
    expect(await review.decideReview(await actorOf(ids.head), { recordId, outcome: 'FINE', reason: REASON, baseReviewId: null })).toMatchObject({ ok: false, status: 403 });

    const hr = await actorOf(ids.hr);
    expect(await review.decideReview(hr, { recordId, outcome: 'FINE', reason: 'x', baseReviewId: null })).toMatchObject({ ok: false, status: 400 });
    expect(await review.decideReview(hr, { recordId, outcome: 'FINE', reason: REASON, baseReviewId: null })).toMatchObject({ ok: true });
    expect(await review.decideReview(hr, { recordId, outcome: 'NEEDS_CORRECTION', reason: REASON, baseReviewId: null })).toMatchObject({ ok: false, status: 409 });
    const [first] = await sql`select id from hris.attendance_reviews where record_id = ${recordId}`;
    const changed = await review.decideReview(hr, { recordId, outcome: 'NEEDS_CORRECTION', reason: REASON, baseReviewId: first.id });
    expect(changed).toMatchObject({ ok: true, data: { link: expect.stringContaining('/kehadiran/koreksi') } });
    const uncorrected = await review.reviewScreen(hr, { tab: 'outside', filter: 'uncorrected', branchId: null }, tomorrow);
    expect(uncorrected.rows.find((row) => row.id === recordId)?.history).toHaveLength(2);
    await expect(sql`update hris.attendance_reviews set reason = 'ubah'`).rejects.toThrow();
    await expect(sql`delete from hris.attendance_reviews`).rejects.toThrow();
    expect(await review.pendingReviewCount(hr, tomorrow)).toBeGreaterThan(0);
  });

  it('koreksi: telat dihitung ulang, catatan asli tetap, bentrok ditolak, orangnya diberi tahu', async () => {
    const hr = await actorOf(ids.hr);
    const item = { employeeId: ids.eka, branchId: pusat, shiftId: null as number | null, inAt: `${day}T08:00`, outAt: `${day}T17:00`, baseCorrectionId: null };
    const screen = await review.correctionScreen(hr, { mode: 'one', employeeId: ids.eka, branchId: null, date: day }, tomorrow);
    item.shiftId = (screen.shiftOptions[String(pusat)] ?? [])[0].id;
    expect(screen.people[0]).toMatchObject({ canCorrect: true, baseCorrectionId: null, lateApplies: true });
    const input = { workDate: day, batchBranchId: null, reasonCode: 'DEVICE' as const, note: REASON, items: [item] };
    const saved = await review.saveCorrections(hr, input, tomorrow);
    expect(saved).toMatchObject({ ok: true, data: { message: expect.stringContaining('0 menit') } });
    expect(await review.saveCorrections(hr, input, tomorrow)).toMatchObject({ ok: false, status: 409 });
    const [days] = await sql`select late_minutes from hris.attendance_days where employee_id = ${ids.eka} and work_date = ${day}`;
    expect(days.late_minutes).toBe(10);
    const [row] = await sql`select late_minutes, prev_in_at from hris.attendance_corrections where employee_id = ${ids.eka}`;
    expect(row.late_minutes).toBe(0);
    expect(new Date(row.prev_in_at)).toEqual(at('08:10'));
    await expect(sql`update hris.attendance_corrections set note = 'ubah'`).rejects.toThrow();
    const notes = await sql`select count(*)::int as n from hris.notifications where kind = 'attendance.corrected' and recipient_account_id = ${ids.eka + 1000}`;
    expect(notes[0].n).toBe(1);
    const filtered = await review.reviewScreen(hr, { tab: 'outside', filter: 'uncorrected', branchId: null }, tomorrow);
    const recordId = await ekaRecordToday();
    expect(filtered.rows.some((r) => r.id === recordId)).toBe(false);
    const card = await review.dayRecordScreen(hr, { employeeId: ids.eka, date: day }, tomorrow);
    expect(card.card).toMatchObject({ lateMinutes: 0, tags: expect.arrayContaining(['Dikoreksi']) });
  });

  it('tidak bisa mengoreksi absen sendiri; Pemilik mengoreksi absen HR', async () => {
    const hr = await actorOf(ids.hr);
    const screen = await review.correctionScreen(hr, { mode: 'one', employeeId: ids.hr, branchId: null, date: day }, tomorrow);
    expect(screen.people[0].canCorrect).toBe(false);
    const shiftId = (screen.shiftOptions[String(pusat)] ?? [])[0].id;
    const input = {
      workDate: day, batchBranchId: null, reasonCode: 'WRONG_RECORD' as const, note: REASON,
      items: [{ employeeId: ids.hr, branchId: pusat, shiftId, inAt: `${day}T08:00`, outAt: null, baseCorrectionId: null }],
    };
    expect(await review.saveCorrections(hr, input, tomorrow)).toMatchObject({ ok: false, status: 403 });
    expect(await review.saveCorrections(await actorOf(ids.owner), input, tomorrow)).toMatchObject({ ok: true });
  });

  it('Tambah absen untuk hari tanpa absen, lalu dibalik; hanya koreksi terakhir yang bisa dibalik', async () => {
    const hr = await actorOf(ids.hr);
    const shiftId = ((await review.correctionScreen(hr, { mode: 'one', employeeId: ids.dedi, branchId: null, date: day }, tomorrow)).shiftOptions[String(pusat)] ?? [])[0].id;
    const add = (inAt: string, base: number | null) => review.saveCorrections(hr, {
      workDate: day, batchBranchId: null, reasonCode: 'DEVICE', note: REASON,
      items: [{ employeeId: ids.dedi, branchId: pusat, shiftId, inAt: `${day}T${inAt}`, outAt: `${day}T17:00`, baseCorrectionId: base }],
    }, tomorrow);
    expect(await add('08:00', null)).toMatchObject({ ok: true });
    const [first] = await sql`select id from hris.attendance_corrections where employee_id = ${ids.dedi}`;
    expect((await review.dayRecordScreen(hr, { employeeId: ids.dedi, date: day }, tomorrow)).card?.tags).toContain('Ditambahkan HR');
    expect(await add('08:15', first.id)).toMatchObject({ ok: true });
    expect(await review.reverseCorrection(hr, { correctionId: first.id, reason: REASON })).toMatchObject({ ok: false, status: 409 });
    const [second] = await sql`select id from hris.attendance_corrections where employee_id = ${ids.dedi} order by id desc limit 1`;
    expect(await review.reverseCorrection(hr, { correctionId: second.id, reason: REASON })).toMatchObject({ ok: true });
    const [last] = await sql`select id from hris.attendance_corrections where employee_id = ${ids.dedi} order by id desc limit 1`;
    expect(await review.reverseCorrection(hr, { correctionId: last.id, reason: REASON })).toMatchObject({ ok: true });
    const card = await review.dayRecordScreen(hr, { employeeId: ids.dedi, date: day }, tomorrow);
    expect(card.card).toMatchObject({ status: 'PRESENT', times: { IN: '08.15' } });
  });

  it('koreksi banyak orang: satu cabang saja; Finance hanya melihat riwayat', async () => {
    const hr = await actorOf(ids.hr);
    const screen = await review.correctionScreen(hr, { mode: 'many', employeeId: null, branchId: pusat, date: day }, tomorrow);
    expect(screen.people.map((person) => person.name)).toContain('Ani');
    const shiftId = (screen.shiftOptions[String(pusat)] ?? [])[0].id;
    const ani = screen.people.find((person) => person.employeeId === ids.ani)!;
    const mixed = await review.saveCorrections(hr, {
      workDate: day, batchBranchId: pusat, reasonCode: 'MOVED', note: REASON, items: [
        { employeeId: ids.ani, branchId: pusat, shiftId, inAt: `${day}T08:00`, outAt: `${day}T17:00`, baseCorrectionId: ani.baseCorrectionId },
        { employeeId: ids.fani, branchId: depan, shiftId, inAt: `${day}T08:00`, outAt: null, baseCorrectionId: null },
      ],
    }, tomorrow);
    expect(mixed).toMatchObject({ ok: false, status: 400 });
    const finance = await actorOf(ids.finance);
    expect(await review.saveCorrections(finance, {
      workDate: day, batchBranchId: null, reasonCode: 'MOVED', note: REASON,
      items: [{ employeeId: ids.ani, branchId: pusat, shiftId, inAt: `${day}T08:00`, outAt: null, baseCorrectionId: null }],
    }, tomorrow)).toMatchObject({ ok: false, status: 403 });
    const history = await review.correctionHistoryScreen(finance, { branchId: null, period: null, q: '' }, tomorrow);
    expect(history.rows.length).toBeGreaterThan(0);
    expect(history.rows.every((row) => !row.canReverse)).toBe(true);
  });

  it('rekap dan Kehadiran Saya memakai angka yang sama; kepala cabang hanya cabangnya', async () => {
    const recap = await review.recapScreen(await actorOf(ids.hr), { period: null, branchId: pusat, employeeId: ids.ani }, tomorrow);
    const aniRow = recap.rows.find((row) => row.employeeId === ids.ani)!;
    const mine = await review.myAttendanceScreen(await actorOf(ids.ani), null, tomorrow);
    expect(mine.tracked && mine.totals).toEqual(aniRow.totals);
    expect(aniRow.totals).toMatchObject({ present: 1, lateCount: 1, lateMinutes: 20 });
    expect(recap.selected?.days.find((card) => card.workDate === day)).toMatchObject({ status: 'PRESENT' });
    const headRecap = await review.recapScreen(await actorOf(ids.foreignHead), { period: null, branchId: null, employeeId: null }, tomorrow);
    expect(headRecap.rows.map((row) => row.name)).toEqual(['Hana', 'Kepala Depan']);
  });

  it('pola lokasi: luar titik berulang dan titik nyaris sama; aman diulang; sudah dilihat sekali', async () => {
    const first = await review.scanAttendancePatterns(at('05:00', addDays(day, 1)));
    expect(first.written).toBe(2);
    expect((await review.scanAttendancePatterns(at('05:00', addDays(day, 1)))).written).toBe(0);
    const flags = await sql`select kind, employee_ids from hris.attendance_pattern_flags order by kind`;
    expect(flags.map((flag) => flag.kind)).toEqual(['REPEAT_OUTSIDE', 'SHARED_POINT']);
    const hr = await actorOf(ids.hr);
    const screen = await review.reviewScreen(hr, { tab: 'patterns', filter: 'pending', branchId: null }, tomorrow);
    const flag = screen.flags.find((item) => item.kind === 'SHARED_POINT')!;
    expect(flag.people.map((person) => person.name).sort()).toEqual(['Eka', 'Fani']);
    expect(await review.markPatternSeen(await actorOf(ids.head), { flagId: flag.id, note: REASON })).toMatchObject({ ok: false, status: 403 });
    expect(await review.markPatternSeen(hr, { flagId: flag.id, note: REASON })).toMatchObject({ ok: true });
    expect(await review.markPatternSeen(hr, { flagId: flag.id, note: REASON })).toMatchObject({ ok: false, status: 409 });
  });

  it('foto absen: tanggal lampau dalam masa simpan bisa dipilih', async () => {
    const head = await actorOf(ids.head);
    const screen = await check.photosScreen(head, null, tomorrow, day);
    expect(screen.date).toBe(day);
    expect(screen.rows.length).toBeGreaterThan(0);
    expect((await check.photosScreen(head, null, tomorrow, '2020-01-01')).date).toBe(addDays(day, 1));
  });
});
