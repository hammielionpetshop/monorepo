import { randomUUID } from 'node:crypto';
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

// Laporan Pulang, Serah Terima, Lapor Masalah, Sudah Pindah Cabang (spec L3d §8) pada DB sintetis.
// Jalan bila ROLES_TEST_ADMIN_URL diisi. Kejadian absen di tanggal lampau supaya tidak bergantung jam.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_eod_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const HANDOVER = 'Stok pasir kucing tinggal dua karung, sudah dicatat.';
const POINT = { latitude: -7.350564720030627, longitude: 108.10865608125447, accuracy: 12 };
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let check: typeof import('./check');
let review: typeof import('./review');
let eod: typeof import('./end-of-day');
let actorOf: (employeeId: number) => Promise<Actor>;
let today: string;
let day: string;
let at: (time: string, date?: string) => Date;
let pusat: number;
let depan: number;
const codes: Record<string, string> = {};
let ids: Record<'owner' | 'gm' | 'hr' | 'head' | 'ani' | 'dedi' | 'hana' | 'rudi', number>;

describe.skipIf(!ADMIN_URL)('L3d: Laporan Pulang, Serah Terima, Lapor Masalah, Sudah Pindah Cabang', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(tmpdir(), `hris-eod-${process.pid}`);
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
      owner: await person('Pemilik', 'Pemilik'), gm: await person('Gina GM', 'GM'), hr: await person('Nadia HR', 'HR'),
      head: await person('Kepala Pusat', 'Kepala Toko'), ani: await person('Ani', 'Kasir'), dedi: await person('Dedi Kurnia', 'Pramuniaga'),
      hana: await person('Hana', 'Kasir', depan), rudi: await person('Rudi', 'Pramuniaga'),
    };
    process.env.DATABASE_URL = url.toString();
    check = await import('./check');
    review = await import('./review');
    eod = await import('./end-of-day');
    const write = await import('./write');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const { todayWib } = await import('@/modules/employees');
    today = todayWib();
    day = addDays(today, -3);
    at = (time, date = day) => wibInstant(date, time);
    const hr = await actorOf(ids.hr);
    for (const branchId of [pusat, depan]) {
      const qr = await write.regenerateQr(hr, branchId);
      if (!qr.ok) throw new Error(qr.error);
      codes[branchId] = qr.data.code;
    }
    // Tanpa shift (absen tetap boleh). Ani, Dedi di Pusat; Hana sendirian di Depan.
    for (const [employeeId, branchId] of [[ids.ani, pusat], [ids.dedi, pusat], [ids.hana, depan]] as const) {
      expect(await fullCheck(employeeId, 'IN', at('08:00'), branchId)).toMatchObject({ ok: true });
      expect(await fullCheck(employeeId, 'OUT', at('17:00'), branchId)).toMatchObject({ ok: true });
    }
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  async function fullCheck(employeeId: number, kind: 'IN' | 'OUT', now: Date, branchId: number) {
    const actor = await actorOf(employeeId);
    const located = await check.checkLocation(actor, { code: codes[branchId], kind, ...POINT }, now);
    if (!located.ok) return located;
    return check.submitAttendance(actor, { attemptId: located.data.attemptId, kind, photo: photo() }, now);
  }

  const dayIdOf = async (employeeId: number, date = day) => Number((await sql`
    select id from hris.attendance_days where employee_id = ${employeeId} and work_date = ${date}`)[0].id);

  const send = async (employeeId: number, now: Date, extra: Partial<import('./end-of-day').EndOfDayInput> = {}) => eod.submitEndOfDay(await actorOf(employeeId), {
    dayId: await dayIdOf(employeeId), handover: HANDOVER, recipientMode: 'TEAM', recipientIds: [], handoverPhoto: null, problem: null, ...extra,
  }, now);

  it('pulang baru dihitung sesudah laporan; tekan dua kali tercatat sekali; tabel hanya tambah', async () => {
    const hr = await actorOf(ids.hr);
    const before = await review.dayRecordScreen(hr, { employeeId: ids.ani, date: day }, at('17:10'));
    expect(before.card).toMatchObject({ times: { OUT: '-' }, tags: expect.arrayContaining(['Laporan Pulang menunggu']) });
    const screen = await eod.endOfDayScreen(await actorOf(ids.ani), at('17:05'));
    expect(screen.pending).toMatchObject({ dayId: await dayIdOf(ids.ani), team: expect.arrayContaining(['Dedi Kurnia']) });
    expect(screen.pending!.team).not.toContain('Ani');

    expect(await send(ids.ani, at('17:06'), { handover: 'aman' })).toMatchObject({ ok: false, status: 400 });
    const first = await send(ids.ani, at('17:06'), { handoverPhoto: photo(), problem: { body: 'Kunci gudang belakang rusak sejak pagi.', photo: photo(), concernsGm: true } });
    expect(first).toMatchObject({ ok: true });
    const again = await send(ids.ani, at('17:07'));
    expect(again.ok && first.ok && again.data.reportId === first.data.reportId).toBe(true);
    expect((await sql`select count(*)::int as n from hris.end_of_day_reports where employee_id = ${ids.ani}`)[0].n).toBe(1);
    expect((await sql`select count(*)::int as n from hris.problem_reports where reporter_employee_id = ${ids.ani}`)[0].n).toBe(1);

    const after = await review.dayRecordScreen(hr, { employeeId: ids.ani, date: day }, at('17:10'));
    expect(after.card?.times.OUT).toBe('17.00');
    expect(after.card?.tags).not.toContain('Laporan Pulang menunggu');
    expect((await eod.endOfDayScreen(await actorOf(ids.ani), at('17:08'))).pending).toBeNull();

    await expect(sql`update hris.end_of_day_reports set handover = 'ubah'`).rejects.toThrow();
    await expect(sql`delete from hris.handover_recipients`).rejects.toThrow();
    await expect(sql`update hris.problem_reports set body = 'ubah'`).rejects.toThrow();

    const kinds = await sql`select recipient_account_id as r, kind from hris.notifications where kind in ('attendance.handover', 'attendance.problem')`;
    expect(kinds).toContainEqual({ r: ids.dedi + 1000, kind: 'attendance.handover' });
    expect(kinds).toContainEqual({ r: ids.owner + 1000, kind: 'attendance.problem' });
    expect(kinds).not.toContainEqual({ r: ids.gm + 1000, kind: 'attendance.problem' });
  });

  it('tanpa laporan sampai 04.00: jam pulang kosong, bertanda, tidak bisa dikirim lagi', async () => {
    const next = addDays(day, 1);
    const card = await review.dayRecordScreen(await actorOf(ids.hr), { employeeId: ids.dedi, date: day }, at('05:00', next));
    expect(card.card).toMatchObject({ times: { OUT: '-' }, tags: expect.arrayContaining(['Laporan pulang tidak terkirim']) });
    expect(await send(ids.dedi, at('04:30', next))).toMatchObject({ ok: false, status: 409 });
  });

  it('sendirian = Tidak ada penerima; Serah Terima Tim sesuai lingkup cabang', async () => {
    expect(await send(ids.hana, at('17:05'))).toMatchObject({ ok: true });
    expect((await sql`select count(*)::int as n from hris.handover_recipients r join hris.end_of_day_reports e on e.id = r.report_id
      where e.employee_id = ${ids.hana}`)[0].n).toBe(0);
    const hrView = await eod.teamHandoversScreen(await actorOf(ids.hr), { branchId: null, from: day, to: day, unread: false, photo: false, q: '' }, at('18:00'));
    expect(hrView.cards.find((card) => card.from === 'Hana')).toMatchObject({ noRecipients: true });
    const headView = await eod.teamHandoversScreen(await actorOf(ids.head), { branchId: null, from: day, to: day, unread: false, photo: false, q: '' }, at('18:00'));
    expect(headView.cards.map((card) => card.from)).toEqual(['Ani']);
    expect((await eod.teamHandoversScreen(await actorOf(ids.head), { branchId: null, from: day, to: day, unread: false, photo: true, q: 'pasir' }, at('18:00'))).cards).toHaveLength(1);
    const reportId = Number((await sql`select id from hris.end_of_day_reports where employee_id = ${ids.ani}`)[0].id);
    expect(await eod.openHandoverPhoto(await actorOf(ids.head), reportId)).toBeTruthy();
    expect(await eod.openHandoverPhoto(await actorOf(ids.hana), reportId)).toBeNull();
  });

  it('jendela baca hanya 7 hari dan hilang sesudah dibaca; Tambah keterangan hanya pengirim', async () => {
    const dedi = await actorOf(ids.dedi);
    const reportId = Number((await sql`select id from hris.end_of_day_reports where employee_id = ${ids.ani}`)[0].id);
    expect((await eod.endOfDayScreen(dedi, at('08:00', addDays(day, 1)))).handovers.map((card) => card.id)).toEqual([reportId]);
    expect((await eod.endOfDayScreen(dedi, at('08:00', addDays(day, 9)))).handovers).toEqual([]);
    expect(await eod.markHandoverRead(await actorOf(ids.hana), reportId)).toMatchObject({ ok: false, status: 404 });
    expect(await eod.markHandoverRead(dedi, reportId)).toMatchObject({ ok: true });
    expect((await eod.endOfDayScreen(dedi, at('08:00', addDays(day, 1)))).handovers).toEqual([]);
    const sent = await eod.myHandoversScreen(await actorOf(ids.ani), 'sent');
    expect(sent.cards[0].readers).toContainEqual({ name: 'Dedi Kurnia', readAt: expect.any(String) });
    expect(await eod.addReportNote(dedi, { kind: 'HANDOVER', reportId, body: 'Tambahan dari orang lain' })).toMatchObject({ ok: false, status: 403 });
    expect(await eod.addReportNote(await actorOf(ids.ani), { kind: 'HANDOVER', reportId, body: 'Karung ketiga ada di rak atas.' })).toMatchObject({ ok: true });
    expect((await eod.myHandoversScreen(dedi, 'received')).cards[0]).toMatchObject({ read: true, notes: [{ text: 'Karung ketiga ada di rak atas.' }] });
  });

  it('laporan menyangkut GM: GM tidak melihat di daftar, hitungan, foto, dan ubah status', async () => {
    const owner = await actorOf(ids.owner);
    const gm = await actorOf(ids.gm);
    const problemId = Number((await sql`select id from hris.problem_reports where reporter_employee_id = ${ids.ani}`)[0].id);
    expect(await eod.problemListScreen(await actorOf(ids.head), { status: null, id: null })).toBeNull();
    expect((await eod.problemListScreen(gm, { status: null, id: null }))!.cards).toEqual([]);
    expect((await eod.problemListScreen(owner, { status: null, id: null }))!.cards.map((card) => card.id)).toEqual([problemId]);
    expect(await eod.openProblemCount(gm)).toBe(0);
    expect(await eod.openProblemCount(owner)).toBe(1);
    expect(await eod.openProblemPhoto(gm, problemId)).toBeNull();
    expect(await eod.openProblemPhoto(owner, problemId)).toBeTruthy();
    expect(await eod.updateProblem(gm, { id: problemId, status: 'DONE', response: '', confirmNames: false })).toMatchObject({ ok: false, status: 404 });

    const warned = await eod.updateProblem(owner, { id: problemId, status: 'IN_PROGRESS', response: 'Sudah dibicarakan dengan Dedi Kurnia.', confirmNames: false });
    expect(warned).toMatchObject({ ok: true, data: { warning: expect.stringContaining('Dedi Kurnia') } });
    expect((await sql`select count(*)::int as n from hris.problem_report_events where report_id = ${problemId}`)[0].n).toBe(1);
    expect(await eod.updateProblem(owner, { id: problemId, status: 'IN_PROGRESS', response: 'Sudah dibicarakan dengan Dedi Kurnia.', confirmNames: true })).toMatchObject({ ok: true });
    const mine = await eod.myProblemsScreen(await actorOf(ids.ani), at('18:00', today));
    expect(mine.rows[0]).toMatchObject({ status: 'IN_PROGRESS', response: 'Sudah dibicarakan dengan Dedi Kurnia.' });
    expect((await sql`select count(*)::int as n from hris.notifications where kind = 'attendance.problem_update' and recipient_account_id = ${ids.ani + 1000}`)[0].n).toBe(1);

    const menu = await eod.submitProblem(await actorOf(ids.dedi), { body: 'Lampu depan toko mati.', photo: null, concernsGm: false }, new Date());
    expect(menu).toMatchObject({ ok: true });
    expect((await eod.problemListScreen(gm, { status: null, id: null }))!.cards.map((card) => card.reporter)).toEqual(['Dedi Kurnia']);
  });

  it('Sudah Pindah Cabang: Belum = ditanya lagi pulang berikutnya; Ya → disetujui HR → penempatan pindah', async () => {
    // 7 hari kerja Rudi di Depan, sampai hari ini (data uji langsung ke tabel).
    const [{ id: positionId }] = await sql`select id from hris.positions where name = 'Pramuniaga'`;
    const worked = async (date: string) => {
      const [dayRow] = await sql`insert into hris.attendance_days (employee_id, work_date, branch_id, position_id, shift_source)
        values (${ids.rudi}, ${date}, ${depan}, ${positionId}, 'NONE') returning id`;
      const fileId = randomUUID();
      await sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${fileId}, 'image/jpeg', 10, 'x', ${ids.rudi + 1000})`;
      const [attempt] = await sql`insert into hris.attendance_attempts (employee_id, kind, branch_id, result) values (${ids.rudi}, 'OUT', ${depan}, 'OK') returning id`;
      const records = [];
      for (const kind of ['IN', 'OUT']) {
        const [record] = await sql`insert into hris.attendance_records (day_id, kind, branch_id, recorded_at, latitude, longitude, distance_m, photo_file_id, attempt_id)
          values (${dayRow.id}, ${kind}, ${depan}, ${wibInstant(date, kind === 'IN' ? '08:00' : '17:00')}, 0, 0, 0, ${fileId}, ${attempt.id}) returning id`;
        records.push(record.id);
      }
      await sql`insert into hris.end_of_day_reports (day_id, out_record_id, employee_id, branch_id, handover, recipient_mode)
        values (${dayRow.id}, ${records[1]}, ${ids.rudi}, ${depan}, ${HANDOVER}, 'TEAM')`;
    };
    for (let i = 7; i >= 1; i -= 1) await worked(addDays(today, -i));
    const rudi = await actorOf(ids.rudi);
    const now = wibInstant(addDays(today, -1), '18:00');
    expect(await eod.relocationPromptFor(rudi, now)).toMatchObject({ workDate: addDays(today, -1), branchName: 'Toko Depan', homeName: 'Toko Pusat' });
    expect(await eod.answerRelocationNotYet(rudi, addDays(today, -1), now)).toMatchObject({ ok: true });
    expect(await eod.relocationPromptFor(rudi, now)).toBeNull();

    await worked(today);
    expect(await eod.relocationPromptFor(rudi)).toMatchObject({ workDate: today });
    const { submitRequest, decideRequest } = await import('@/modules/requests');
    const { REQUEST_HANDLERS } = await import('@/lib/request-handlers');
    const submitted = await submitRequest(rudi, 'relocation', REQUEST_HANDLERS.relocation, { fields: { workDate: today }, attachmentIds: [] });
    expect(submitted).toMatchObject({ ok: true });
    expect(await eod.relocationPromptFor(rudi)).toBeNull();
    const requestId = submitted.ok ? submitted.data.id : 0;
    const [{ version }] = await sql`select version from hris.requests where id = ${requestId}`;

    const hr = await actorOf(ids.hr);
    const { can } = await import('@/modules/access');
    expect(can(hr, 'relocation.decide', { personId: ids.hr })).toBe(false);
    expect(await decideRequest(rudi, requestId, REQUEST_HANDLERS, { decision: 'APPROVE', expectedVersion: version })).toMatchObject({ ok: false, status: 403 });
    const decided = await decideRequest(hr, requestId, REQUEST_HANDLERS, { decision: 'APPROVE', expectedVersion: version });
    expect(decided).toMatchObject({ ok: true, data: { message: expect.stringContaining('Toko Depan') } });
    const [placement] = await sql`select branch_id, position_id from hris.current_placements where employee_id = ${ids.rudi}`;
    expect(Number(placement.branch_id)).toBe(depan);
    expect(Number(placement.position_id)).toBe(Number(positionId));
    const [moved] = await sql`select effective_from::text as d from hris.placements where employee_id = ${ids.rudi} and kind = 'BRANCH'`;
    expect(moved.d).toBe(today);
  });
});
