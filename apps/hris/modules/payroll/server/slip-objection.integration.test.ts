import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L4g-2 Keberatan slip, Tautkan pembetulan, Pembetulan gaji periode lalu, koreksi minus → Piutang Lain (spec L4g §3.5–3.6, §8)
// pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi. Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 26 November 2026
// pukul 10.00 WIB (periode sudah berakhir; tutup slip memakai mode uji staging).
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4g2_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const NOW = new Date('2026-11-26T03:00:00Z');
const TODAY = '2026-11-26';
const P = '2026-10-26';
const NEXT = '2026-11-26';
const REASON = 'Lembur tanggal dua belas belum masuk slip saya';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let slip: typeof import('./payslip');
let reopen: typeof import('./payslip-reopen');
let pay: typeof import('./payment');
let objection: typeof import('./slip-objection');
let correction: typeof import('./salary-correction');
let offSlip: typeof import('./off-slip');
let data: typeof import('./data');
let requestsMod: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'gm' | 'hr' | 'ani' | 'budi' | 'cici' | 'dodi', number>;
let brankas: number;

describe.skipIf(!ADMIN_URL)('L4g-2: Keberatan slip dan pembetulan', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    process.env.AUTH_COOKIE_ENV = 'staging';
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    sql = postgres(url.toString(), { max: 4, onnotice: () => {} });
    await sql`create schema petshop`;
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`;
    await sql.unsafe(readFileSync(new URL('hris-db/test-stubs/petshop-pos.sql', root), 'utf8'));
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
    const [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', -6.2, 106.8) returning id`;
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
        values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
      await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, 2600000)`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), owner2: await person('Irma', 'Pemilik'), gm: await person('Gina', 'GM'), hr: await person('Nadia HR', 'HR'),
      ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir'), cici: await person('Cici', 'Kasir'), dodi: await person('Dodi', 'Kasir'),
    };
    // Dodi berhenti di tengah periode (dengan pemberitahuan): slip periode ini slip terakhirnya.
    await sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, resignation_notice, note, created_by_account_id)
      values (${ids.dodi}, 'DEACTIVATE', '2026-11-20', 'RESIGNED', 'WITH_NOTICE', 'Pindah kota bersama keluarga', 1)`;
    slip = await import('./payslip');
    reopen = await import('./payslip-reopen');
    pay = await import('./payment');
    objection = await import('./slip-objection');
    correction = await import('./salary-correction');
    offSlip = await import('./off-slip');
    data = await import('./data');
    requestsMod = await import('@/modules/requests');
    handlers = {
      payslip_objection: objection.payslipObjectionHandler(noAnnounce, 'payslip_objection'),
      payslip_objection_owner: objection.payslipObjectionHandler(noAnnounce, 'payslip_objection_owner'),
    };
    brankas = Number((await sql`select id from hris.payment_sources where name = 'Brankas'`)[0].id);
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const gm = await actorOf(ids.gm);
    await slip.periodScreen(gm, P);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const slipIdOf = async (employeeId: number, period = P) =>
    Number((await sql`select id from hris.payslips where employee_id = ${employeeId} and period_start = ${period}`)[0]?.id);
  const close = async (employeeIds: number[]) => {
    const result = await slip.closeSlips(await actorOf(ids.gm), { slipIds: await Promise.all(employeeIds.map((e) => slipIdOf(e))), periodStart: null }, noAnnounce);
    if (!result.ok) throw new Error(result.error);
    return result.data.outcomes;
  };
  const payOf = (slipIds: number[]) => actorOf(ids.owner).then((a) => pay.paySlips(a, { slipIds, sourceId: brankas, moneyDate: TODAY }, noAnnounce));
  const submit = async (employeeId: number, typeKey: 'payslip_objection' | 'payslip_objection_owner', fields: Record<string, unknown>, resubmittedFromId: number | null = null) =>
    requestsMod.submitRequest(await actorOf(employeeId), typeKey, handlers[typeKey], { fields, attachmentIds: [], resubmittedFromId });
  const decide = async (actorId: number, requestId: number, decision: 'APPROVE' | 'REJECT', extra: { reason?: string; choice?: string } = {}) => {
    const [row] = await sql`select version from hris.requests where id = ${requestId}`;
    return requestsMod.decideRequest(await actorOf(actorId), requestId, handlers, {
      decision, expectedVersion: Number(row.version), reason: extra.reason, fields: { choice: extra.choice },
    });
  };
  const objectionOf = async (requestId: number) => (await sql`select * from hris.payslip_objections where request_id = ${requestId}`)[0];
  const personOf = async (employeeId: number, period = NEXT) => {
    const end = period === P ? '2026-11-25' : '2026-12-25';
    return (await data.loadPeriodPeople(period, end)).find((p) => p.id === employeeId)!;
  };

  it('sebelum periode berakhir tidak bisa; sesudahnya Perkiraan bisa dikeberati', async () => {
    const ani = await slipIdOf(ids.ani);
    vi.setSystemTime(new Date('2026-11-20T03:00:00Z'));
    expect(await submit(ids.ani, 'payslip_objection', { slipId: ani, kind: 'WRONG', lines: [], reason: REASON })).toMatchObject({ ok: false, status: 409 });
    vi.setSystemTime(NOW);
    const screen = await objection.slipObjectionFormScreen(await actorOf(ids.ani), ani, 'WRONG', null);
    expect(screen).toMatchObject({ open: true, typeKey: 'payslip_objection', slip: { estimate: true } });
    // Slip orang lain = tidak ditemukan.
    expect(await objection.slipObjectionFormScreen(await actorOf(ids.budi), ani, 'WRONG', null)).toBeNull();
  });

  it('ditutup → keberatan → kembar ditolak → tolak (alasan ≥ 15 huruf) → ajukan ulang', async () => {
    expect((await close([ids.ani, ids.budi, ids.cici, ids.dodi])).every((o) => o.result === 'CLOSED')).toBe(true);
    const ani = await slipIdOf(ids.ani);
    const line = (await sql`select source_key from hris.payslip_lines where payslip_id = ${ani} and status = 'ACTIVE' order by sort_order limit 1`)[0].source_key as string;
    expect(await submit(ids.ani, 'payslip_objection', { slipId: ani, kind: 'WRONG', lines: [line], reason: 'pendek' })).toMatchObject({ ok: false, status: 400 });
    expect(await submit(ids.ani, 'payslip_objection', { slipId: ani, kind: 'WRONG', lines: ['bukan:baris'], reason: REASON })).toMatchObject({ ok: false, status: 400 });
    expect(await submit(ids.ani, 'payslip_objection_owner', { slipId: ani, kind: 'WRONG', lines: [line], reason: REASON })).toMatchObject({ ok: false, status: 400 });
    const first = await submit(ids.ani, 'payslip_objection', { slipId: ani, kind: 'WRONG', lines: [line], reason: REASON });
    expect(first).toMatchObject({ ok: true });
    expect(await submit(ids.ani, 'payslip_objection', { slipId: ani, kind: 'WRONG', lines: [], reason: REASON })).toMatchObject({ ok: false, status: 409 });
    const id = first.ok ? first.data.id : 0;
    expect(await objectionOf(id)).toMatchObject({ kind: 'WRONG', slip_status: 'CLOSED', state: 'PENDING' });
    expect(await decide(ids.ani, id, 'REJECT', { reason: 'Tidak boleh memutuskan sendiri' })).toMatchObject({ ok: false, status: 403 });
    expect(await decide(ids.hr, id, 'REJECT', { reason: 'Sudah benar ya' })).toMatchObject({ ok: false, status: 400 });
    expect(await decide(ids.hr, id, 'REJECT', { reason: 'Lembur tanggal itu tidak disuruh atasan' })).toMatchObject({ ok: true });
    expect(await objectionOf(id)).toMatchObject({ state: 'REJECTED', fix_status: 'NONE' });
    const again = await submit(ids.ani, 'payslip_objection', { slipId: ani, kind: 'WRONG', lines: [line], reason: `${REASON}, ada foto kertas lembur` }, id);
    expect(again).toMatchObject({ ok: true });
  });

  it('setujui (jalan disaring server) → buka kembali → tutup ulang → tautkan; catatan sebelum keputusan tidak bisa', async () => {
    const ani = await slipIdOf(ids.ani);
    const [{ request_id: id }] = await sql`select request_id from hris.payslip_objections where payslip_id = ${ani} and state = 'PENDING'`;
    expect(await handlers.payslip_objection.approveChoices!(Number(id))).toMatchObject({ options: [{ value: 'REOPEN' }] });
    expect(await decide(ids.hr, Number(id), 'APPROVE', { choice: 'PAST_CORRECTION' })).toMatchObject({ ok: false, status: 400 });
    expect(await decide(ids.hr, Number(id), 'APPROVE', { choice: 'REOPEN' })).toMatchObject({ ok: true });
    expect(await objectionOf(Number(id))).toMatchObject({ state: 'APPROVED', fix_path: 'REOPEN', fix_status: 'WAITING_FIX' });
    const hr = await actorOf(ids.hr);
    expect((await objection.linkFixScreen(hr, Number(id)))!.candidates).toHaveLength(0);
    expect(await objection.linkFixScreen(await actorOf(ids.ani), Number(id))).toBeNull();
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    expect(await reopen.reopenSlip(await actorOf(ids.owner), ani, 'Lembur tanggal dua belas belum masuk', noAnnounce)).toMatchObject({ ok: true });
    expect((await close([ids.ani]))[0]).toMatchObject({ result: 'CLOSED' });
    const screen = await objection.linkFixScreen(hr, Number(id));
    const version = screen!.candidates.find((c) => c.kind === 'SLIP_VERSION');
    expect(version).toBeDefined();
    expect(await objection.linkFix(hr, Number(id), { kind: 'SLIP_VERSION', id: 999_999 })).toMatchObject({ ok: false, status: 400 });
    expect(await objection.linkFix(hr, Number(id), { kind: 'SLIP_VERSION', id: version!.id })).toMatchObject({ ok: true });
    expect(await objectionOf(Number(id))).toMatchObject({ fix_status: 'FIXED', fix_kind: 'SLIP_VERSION' });
    expect(await objection.linkFix(hr, Number(id), { kind: 'SLIP_VERSION', id: version!.id })).toMatchObject({ ok: false, status: 409 });
    const notice = await sql`select title from hris.notifications where kind = 'payslip_objection.fixed' and recipient_account_id = ${ids.ani + 1000}`;
    expect(notice).toHaveLength(1);
    vi.setSystemTime(NOW);
  });

  it('"uang belum diterima": hanya Pemilik/GM; batal bayar lalu bayar ulang tertaut otomatis', async () => {
    const budi = await slipIdOf(ids.budi);
    expect(await submit(ids.budi, 'payslip_objection_owner', { slipId: budi, kind: 'NOT_RECEIVED', lines: [], reason: REASON })).toMatchObject({ ok: false, status: 409 });
    const paid = await payOf([budi]);
    expect(paid.ok && paid.data.outcomes[0]).toMatchObject({ result: 'PAID' });
    // Jam DB nyata lebih awal dari "sekarang" palsu tes: samakan saat ditandai Dibayar dengan sekarang.
    await sql`update hris.payslip_payments set created_at = ${NOW} where payslip_id = ${budi}`;
    expect(await submit(ids.budi, 'payslip_objection', { slipId: budi, kind: 'NOT_RECEIVED', lines: [], reason: 'Transfer gaji belum masuk ke rekening saya' })).toMatchObject({ ok: false, status: 400 });
    const sent = await submit(ids.budi, 'payslip_objection_owner', { slipId: budi, kind: 'NOT_RECEIVED', lines: [], reason: 'Transfer gaji belum masuk ke rekening saya' });
    expect(sent).toMatchObject({ ok: true });
    const id = sent.ok ? sent.data.id : 0;
    expect(await decide(ids.hr, id, 'APPROVE', { choice: 'CANCEL_PAYMENT' })).toMatchObject({ ok: false, status: 403 });
    expect(await decide(ids.owner, id, 'APPROVE', { choice: 'CANCEL_PAYMENT' })).toMatchObject({ ok: true });
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    expect(await pay.cancelPayment(await actorOf(ids.owner), budi, 'Transfer gagal, rekening salah ketik', noAnnounce)).toMatchObject({ ok: true });
    const again = await payOf([budi]);
    expect(again.ok && again.data.outcomes[0]).toMatchObject({ result: 'PAID' });
    expect(await objectionOf(id)).toMatchObject({ fix_status: 'FIXED', fix_kind: 'PAYMENT' });
    vi.setSystemTime(NOW);
  });

  it('Pembetulan gaji periode lalu: hanya Pemilik/GM, periode tertutup; selisih jadi "Koreksi gaji tetap" dua arah', async () => {
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const input = (employeeId: number, amount: number, effectiveFrom = P) => ({
      employeeId, effectiveFrom, lines: [{ componentTypeId: Number(pokok), amount }], reason: 'Gaji pokok periode itu salah ketik', objectionId: null,
    });
    expect(await correction.correctPastSalary(await actorOf(ids.hr), input(ids.budi, 3_000_000), noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await correction.correctPastSalary(await actorOf(ids.owner), input(ids.budi, 3_000_000, NEXT), noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await correction.correctPastSalary(await actorOf(ids.owner), { ...input(ids.budi, 3_000_000), reason: '' }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await correction.correctPastSalary(await actorOf(ids.owner), input(ids.budi, 3_000_000), noAnnounce)).toMatchObject({ ok: true });
    expect(await correction.correctPastSalary(await actorOf(ids.owner), input(ids.cici, 2_000_000), noAnnounce)).toMatchObject({ ok: true });
    expect((await sql`select origin from hris.salary_changes where employee_id = ${ids.budi} and cancelled_at is null and effective_from = ${P}`)[0]).toMatchObject({ origin: 'CORRECTION' });
    // Slip lama tidak berubah.
    expect(Number((await sql`select net from hris.payslips where id = ${await slipIdOf(ids.budi)}`)[0].net)).toBeGreaterThan(0);
    const budiNext = await slip.computeSlip(await personOf(ids.budi), NEXT);
    expect(budiNext!.computation.lines.find((l) => l.sourceKey === `corr:${P}:BASE`)).toMatchObject({ section: 'INCOME', label: expect.stringMatching(/^Koreksi gaji tetap/) });
    const ciciNext = await slip.computeSlip(await personOf(ids.cici), NEXT);
    expect(ciciNext!.computation.lines.find((l) => l.sourceKey === `corr:${P}:BASE`)).toMatchObject({ section: 'DEDUCTION', group: 'a' });
  });

  it('koreksi minus sesudah slip terakhir Dibayar menjadi Piutang Lain (sekali, tidak berlipat)', async () => {
    const dodi = await slipIdOf(ids.dodi);
    expect((await sql`select last_slip from hris.payslips where id = ${dodi}`)[0]).toMatchObject({ last_slip: true });
    const paid = await payOf([dodi]);
    expect(paid.ok && paid.data.outcomes[0]).toMatchObject({ result: 'PAID' });
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const done = await correction.correctPastSalary(await actorOf(ids.owner), {
      employeeId: ids.dodi, effectiveFrom: P, lines: [{ componentTypeId: Number(pokok), amount: 2_000_000 }], reason: 'Gaji pokok periode itu salah ketik', objectionId: null,
    }, noAnnounce);
    expect(done).toMatchObject({ ok: true });
    await offSlip.syncOffSlipClaims([ids.dodi]);
    await offSlip.syncOffSlipClaims([ids.dodi]);
    const rows = await sql`select deduction_group, amount, status, origin, source_key, payslip_id from hris.other_receivables where employee_id = ${ids.dodi}`;
    expect(rows).toEqual([expect.objectContaining({ deduction_group: 'a', status: 'OPEN', origin: 'PAST_CORRECTION', source_key: `corr:${P}:BASE`, payslip_id: dodi })]);
    expect(Number(rows[0].amount)).toBeGreaterThan(0);
  });
});
