import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';
import { periodStartOf } from '../rules/days-off';
import { addDays } from '../rules/schedule';

// Izin, Sakit, dan Cuti (spec L3f §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal dihitung dari hari ini sungguhan (batas waktu dihitung server dari jam kirim).
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_absence_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1])], 'surat.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let absence: typeof import('./absence');
let review: typeof import('./review');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let T: string;
let pusat: number;
let ids: Record<'owner' | 'hr' | 'head' | 'ani' | 'budi' | 'cici' | 'dedi' | 'eka', number>;
const d = (offset: number) => addDays(T, offset);

describe.skipIf(!ADMIN_URL)('L3f: Izin, Sakit, dan Cuti', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(tmpdir(), `hris-izin-${process.pid}`);
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
    T = todayWib();
    [{ id: pusat }] = await sql`insert into hris.branches (name) values ('Toko Pusat') returning id`;
    const person = async (name: string, position: string, joinedOn: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, ${joinedOn}, 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${pos.id}, 'EMPLOYEE', ${joinedOn})`;
      return Number(row.id);
    };
    // Tahun cuti yang sedang berjalan mulai 35 hari lalu, supaya rentang uji tidak melewati akhir tahun cuti.
    const longAgo = addDays(T, -400);
    ids = {
      owner: await person('Pemilik', 'Pemilik', longAgo), hr: await person('Nadia HR', 'HR', longAgo),
      head: await person('Kepala Pusat', 'Kepala Toko', longAgo), ani: await person('Ani', 'Kasir', longAgo),
      budi: await person('Budi Baru', 'Pramuniaga', addDays(T, -30)), cici: await person('Cici', 'Kasir', longAgo),
      dedi: await person('Dedi', 'Pramuniaga', longAgo), eka: await person('Eka', 'Pramuniaga', longAgo),
    };
    absence = await import('./absence');
    review = await import('./review');
    engine = await import('@/modules/requests');
    handlers = { absence: absence.absenceHandler as unknown as RequestHandler };
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const submit = async (employeeId: number, fields: Record<string, unknown>, attachmentIds: string[] = []) => (
    engine.submitRequest(await actorOf(employeeId), 'absence', handlers.absence, { fields: { reason: REASON, ...fields }, attachmentIds })
  );
  const version = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const decide = async (by: number, id: number, decision: 'APPROVE' | 'REJECT') => (
    engine.decideRequest(await actorOf(by), id, handlers, { decision, expectedVersion: await version(id), reason: REASON })
  );
  const balance = async (employeeId: number) => {
    const screen = await absence.leaveScreen(await actorOf(employeeId), null);
    return screen && screen.tracked ? screen.current?.balance ?? null : null;
  };
  const activeDays = async (employeeId: number) => (await sql`
    select work_date::text as d, count_kind::text as k from hris.absence_days where employee_id = ${employeeId} and active order by work_date`)
    .map((row) => `${row.d}:${row.k}`);

  it('hak awal tertanam: HR memutuskan, mengisikan, dan menyesuaikan; Kasir tidak', async () => {
    const hr = await actorOf(ids.hr);
    expect(hr.grants.get('absence.decide')).toBe('ALL');
    expect(hr.grants.get('absence.submit_for')).toBe('ALL');
    expect(hr.grants.get('absence.adjust_leave')).toBe('ALL');
    expect((await actorOf(ids.ani)).grants.has('absence.decide')).toBe(false);
  });

  it('Pemilik/GM tidak mengajukan (KAR-67)', async () => {
    const result = await submit(ids.owner, { kind: 'PERMIT', startDate: d(10) });
    expect(result.ok).toBe(false);
  });

  it('KEH-41: libur di tengah tidak dihitung; KEH-142: kurang dari H-2 dicatat izin mendadak', async () => {
    const offDate = d(21);
    await sql`insert into hris.day_off_picks (employee_id, period_start, off_date, origin, created_by_account_id)
      values (${ids.dedi}, ${periodStartOf(offDate)}, ${offDate}, 'PICK', 1)`;
    const normal = await submit(ids.dedi, { kind: 'PERMIT', startDate: d(20), endDate: d(22) });
    expect(normal.ok).toBe(true);
    expect(await activeDays(ids.dedi)).toEqual([`${d(20)}:PERMIT`, `${d(22)}:PERMIT`]);
    const sudden = await submit(ids.dedi, { kind: 'PERMIT', startDate: d(1) });
    expect(sudden.ok).toBe(true);
    const [row] = await sql`select sudden from hris.absence_requests where employee_id = ${ids.dedi} and start_date = ${d(1)}`;
    expect(row.sudden).toBe(true);
    expect(await activeDays(ids.dedi)).toContain(`${d(1)}:PERMIT_SUDDEN`);
  });

  it('KEH-149: tanggal bentrok ditolak; dua kirim bersamaan hanya satu lolos', async () => {
    const clash = await submit(ids.dedi, { kind: 'SICK', startDate: d(22) });
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.status).toBe(409);
    const both = await Promise.all([
      submit(ids.eka, { kind: 'PERMIT', startDate: d(30) }), submit(ids.eka, { kind: 'PERMIT', startDate: d(30), endDate: d(31) }),
    ]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect((await sql`select count(*)::int as n from hris.absence_days where employee_id = ${ids.eka} and work_date = ${d(30)} and active`)[0].n).toBe(1);
  });

  it('KEH-143, 141: sakit tanpa surat paling lama 2 hari kerja; sakit lewat 3 hari sesudah hari pertama ditolak', async () => {
    const long = await submit(ids.cici, { kind: 'SICK', startDate: d(40), endDate: d(42) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain('surat dokter');
    expect((await submit(ids.cici, { kind: 'SICK', startDate: d(40), endDate: d(41) })).ok).toBe(true);
    // Hari ke-3 yang menyambung sakit sebelumnya juga ditolak.
    expect((await submit(ids.cici, { kind: 'SICK', startDate: d(42) })).ok).toBe(false);
    expect((await submit(ids.cici, { kind: 'SICK', startDate: d(-5) })).ok).toBe(false);
  });

  it('KEH-145: cuti dipesan, ditolak kembali, disetujui terpakai, batal sebelum mulai kembali, dicabut kembali', async () => {
    expect(await balance(ids.ani)).toBe(10);
    expect((await submit(ids.ani, { kind: 'ANNUAL_LEAVE', startDate: d(3) })).ok).toBe(false); // H-7
    const first = await submit(ids.ani, { kind: 'ANNUAL_LEAVE', startDate: d(50), endDate: d(52) });
    if (!first.ok) throw new Error(first.error);
    expect(await balance(ids.ani)).toBe(7);
    expect((await decide(ids.hr, first.data.id, 'REJECT')).ok).toBe(true);
    expect(await balance(ids.ani)).toBe(10);
    expect(await activeDays(ids.ani)).toEqual([]);

    const second = await submit(ids.ani, { kind: 'ANNUAL_LEAVE', startDate: d(50), endDate: d(52) });
    if (!second.ok) throw new Error(second.error);
    expect((await decide(ids.hr, second.data.id, 'APPROVE')).ok).toBe(true);
    expect(await balance(ids.ani)).toBe(7);
    const cancelled = await engine.cancelRequest(await actorOf(ids.ani), second.data.id, await version(second.data.id), REASON, handlers);
    expect(cancelled.ok).toBe(true);
    expect(await balance(ids.ani)).toBe(10);

    const third = await submit(ids.ani, { kind: 'ANNUAL_LEAVE', startDate: d(60), endDate: d(60) });
    if (!third.ok) throw new Error(third.error);
    await decide(ids.hr, third.data.id, 'APPROVE');
    // Pengaju tidak bisa mencabut; HR bisa, dengan alasan.
    expect((await engine.revokeRequest(await actorOf(ids.ani), third.data.id, await version(third.data.id), REASON, handlers)).ok).toBe(false);
    expect((await engine.revokeRequest(await actorOf(ids.hr), third.data.id, await version(third.data.id), REASON, handlers)).ok).toBe(true);
    expect((await sql`select status from hris.requests where id = ${third.data.id}`)[0].status).toBe('REVOKED');
    expect(await balance(ids.ani)).toBe(10);
  });

  it('KEH-145: cuti melebihi sisa ditolak; masa kerja belum 1 tahun ditolak; Sesuaikan sisa tercatat', async () => {
    const adjusted = await absence.adjustLeave(await actorOf(ids.hr), { employeeId: ids.ani, days: -8, reason: REASON });
    expect(adjusted.ok).toBe(true);
    expect(await balance(ids.ani)).toBe(2);
    expect((await absence.adjustLeave(await actorOf(ids.ani), { employeeId: ids.ani, days: 5, reason: REASON })).ok).toBe(false);
    expect((await absence.adjustLeave(await actorOf(ids.hr), { employeeId: ids.ani, days: -5, reason: REASON })).ok).toBe(false);
    const over = await submit(ids.ani, { kind: 'ANNUAL_LEAVE', startDate: d(70), endDate: d(72) });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toContain('Sisa cuti 2 hari');
    const newcomer = await submit(ids.budi, { kind: 'ANNUAL_LEAVE', startDate: d(70) });
    expect(newcomer.ok).toBe(false);
  });

  it('KEH-148: isikan atas nama; yang mengisi tidak memutuskan; Kasir tidak bisa mengisikan', async () => {
    const hr = await actorOf(ids.hr);
    const filled = await engine.submitRequest(hr, 'absence', handlers.absence, {
      fields: { kind: 'PERMIT', startDate: d(80), reason: REASON, onBehalf: true, employeeId: ids.cici, onBehalfReason: 'Tidak punya HP untuk mengajukan' },
      attachmentIds: [],
    });
    if (!filled.ok) throw new Error(filled.error);
    const [row] = await sql`select subject_employee_id, submitted_by_employee_id from hris.requests where id = ${filled.data.id}`;
    expect([Number(row.subject_employee_id), Number(row.submitted_by_employee_id)]).toEqual([ids.cici, ids.hr]);
    expect((await decide(ids.hr, filled.data.id, 'APPROVE')).ok).toBe(false);
    expect((await decide(ids.owner, filled.data.id, 'APPROVE')).ok).toBe(true);
    const self = await engine.submitRequest(hr, 'absence', handlers.absence, {
      fields: { kind: 'PERMIT', startDate: d(81), reason: REASON, onBehalf: true, employeeId: ids.hr, onBehalfReason: REASON }, attachmentIds: [],
    });
    expect(self.ok).toBe(false);
    const kasir = await engine.submitRequest(await actorOf(ids.ani), 'absence', handlers.absence, {
      fields: { kind: 'PERMIT', startDate: d(82), reason: REASON, onBehalf: true, employeeId: ids.cici, onBehalfReason: REASON }, attachmentIds: [],
    });
    expect(kasir.ok).toBe(false);
  });

  it('KEH-143, 144: surat menyusul dihitung sakit tanpa surat lalu naik; pembukaan foto oleh HR tercatat', async () => {
    const sick = await submit(ids.eka, { kind: 'SICK_LETTER', startDate: d(-1), letterPending: true });
    if (!sick.ok) throw new Error(sick.error);
    expect(await activeDays(ids.eka)).toContain(`${d(-1)}:SICK`);
    const [{ id: absenceId }] = await sql`select id from hris.absence_requests where request_id = ${sick.data.id}`;
    const sent = await absence.submitDoctorLetter(await actorOf(ids.eka), Number(absenceId), photo());
    if (!sent.ok) throw new Error(sent.error);
    expect(await activeDays(ids.eka)).toContain(`${d(-1)}:SICK_LETTER`);
    expect((await absence.submitDoctorLetter(await actorOf(ids.eka), Number(absenceId), photo())).ok).toBe(false);
    const [{ file_id: fileId }] = await sql`select file_id from hris.doctor_letters where absence_request_id = ${absenceId}`;
    await absence.logAbsenceAttachmentView(await actorOf(ids.eka), sick.data.id, fileId);
    await absence.logAbsenceAttachmentView(await actorOf(ids.hr), sick.data.id, fileId);
    expect((await sql`select viewer_account_id from hris.doctor_letter_views where file_id = ${fileId}`).map((r) => Number(r.viewer_account_id)))
      .toEqual([ids.hr + 1000]);
  });

  it('KEH-118: sakit disetujui menjadi status Sakit di Catatan Hari Kerja dan Rekap', async () => {
    const sick = await submit(ids.dedi, { kind: 'SICK', startDate: d(-1) });
    if (!sick.ok) throw new Error(sick.error);
    const hr = await actorOf(ids.hr);
    const before = await review.dayRecordScreen(hr, { employeeId: ids.dedi, date: d(-1) });
    expect(before.card?.status).toBe('UNDETERMINED');
    expect(before.card?.tags).toContain('Pengajuan tidak masuk menunggu keputusan');
    await decide(ids.hr, sick.data.id, 'APPROVE');
    const after = await review.dayRecordScreen(hr, { employeeId: ids.dedi, date: d(-1) });
    expect(after.card?.status).toBe('SICK');
  });

  it('libur dan tukar ditolak di tanggal izin (catatan L3e §10)', async () => {
    expect(await absence.absenceClash([{ employeeId: ids.dedi, date: d(20) }])).toContain('izin, sakit, atau cuti');
    expect(await absence.absenceClash([{ employeeId: ids.dedi, date: d(25) }])).toBeNull();
  });

  it('tidak ada hapus; hari yang dilepas tidak bisa diaktifkan lagi; hangus sekali walau mesin diulang', async () => {
    await expect(sql`delete from hris.absence_days`).rejects.toThrow();
    await expect(sql`delete from hris.leave_movements`).rejects.toThrow();
    const [released] = await sql`select id from hris.absence_days where not active limit 1`;
    await expect(sql`update hris.absence_days set active = true where id = ${released.id}`).rejects.toThrow();
    const [year] = await sql`insert into hris.leave_years (employee_id, start_date, end_date, quota)
      values (${ids.head}, ${addDays(T, -400)}, ${addDays(T, -36)}, 10) returning id`;
    await absence.runAbsenceDaily();
    await absence.runAbsenceDaily();
    const expired = await sql`select days from hris.leave_movements where leave_year_id = ${year.id} and kind = 'EXPIRE'`;
    expect(expired.map((r) => Number(r.days))).toEqual([10]);
  });
});
