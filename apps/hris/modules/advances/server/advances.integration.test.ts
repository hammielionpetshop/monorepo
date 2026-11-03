import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L5a Kasbon (spec L5 §8) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l5a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const NOW = new Date('2026-11-10T05:00:00Z');
const P = '2026-10-26';
const NEXT = '2026-11-26';
const REASON = 'Biaya berobat anak di puskesmas';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'hr' | 'fin' | 'ani' | 'budi' | 'baru', number>;
let handlers: Record<string, RequestHandler>;
let adv: typeof import('@/modules/advances');
let engine: typeof import('@/modules/requests');
let slip: typeof import('@/modules/payroll');
let sourceId: number;

describe.skipIf(!ADMIN_URL)('L5a: Kasbon dari ajukan sampai terpotong di slip', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
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
    process.env.AUTH_COOKIE_ENV = 'staging';
    const [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', -6.2, 106.8) returning id`;
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const person = async (name: string, position: string, joined = '2026-01-01', monthly: number | null = 2_600_000) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, ${joined}, 'BCA', '1234567890') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${p.id}, 'EMPLOYEE', ${joined})`;
      if (monthly) {
        const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
          values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
        await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, ${monthly})`;
      }
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), owner2: await person('Irma', 'Pemilik'), hr: await person('Nadia HR', 'HR'), fin: await person('Fani', 'Finance'),
      ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir', '2026-01-01', 60_000), baru: await person('Baru', 'Kasir', '2026-08-01'),
    };
    [{ id: sourceId }] = await sql`select id from hris.payment_sources order by id limit 1`;
    adv = await import('@/modules/advances');
    engine = await import('@/modules/requests');
    slip = await import('@/modules/payroll');
    handlers = {
      advance: adv.advanceHandler(), advance_cancel: adv.advanceCancelHandler(noAnnounce), advance_not_received: adv.advanceNotReceivedHandler(),
    } as Record<string, RequestHandler>;
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const submit = async (actorId: number, fields: Record<string, unknown>) =>
    engine.submitRequest(await actorOf(actorId), 'advance', handlers.advance, { fields: { reason: REASON, installments: 2, ...fields }, attachmentIds: [] });
  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const advanceOf = async (requestId: number) => (await sql`select * from hris.advances where request_id = ${requestId}`)[0];
  const slipIdOf = async (employeeId: number, period = P) =>
    Number((await sql`select id from hris.payslips where employee_id = ${employeeId} and period_start = ${period}`)[0]?.id);
  const viewOf = async (id: number) => (await adv.loadAdvances({ ids: [id] }))[0];

  it('syarat: belum 6 bulan, lewat batas orang (kalimat DRV-57), lalu satu pengajuan menunggu per orang', async () => {
    expect(await submit(ids.baru, { amount: 100_000 })).toMatchObject({ ok: false, error: expect.stringContaining('6 bulan') });
    expect(await submit(ids.ani, { amount: 300_000 })).toMatchObject({ ok: false, error: expect.stringContaining('setelah gajian') });
    expect(await submit(ids.ani, { amount: 155_000 })).toMatchObject({ ok: false, error: expect.stringContaining('kelipatan') });
    const ok = await submit(ids.ani, { amount: 150_000 });
    expect(ok.ok).toBe(true);
    expect(await submit(ids.ani, { amount: 50_000 })).toMatchObject({ ok: false, error: expect.stringContaining('menunggu') });
    const row = await advanceOf(ok.ok ? ok.data.id : 0);
    expect(row).toMatchObject({ number: 'KB-0001', state: 'OPEN', fund: 'MONTHLY', requested_amount: 150_000 });
    // Finance diberi tahu lebih dulu (pemeriksa), bukan Pemilik.
    const notes = await sql`select recipient_account_id from hris.notifications where kind = 'request.submitted' and entity_id = ${ok.ok ? ok.data.id : 0}`;
    expect(notes.map((n) => Number(n.recipient_account_id))).toEqual([ids.fin + 1000]);
  });

  it('Finance memeriksa (usulan turun wajib catatan, tidak bisa menyetujui); Pemilik menyetujui angka akhir ≤ diajukan', async () => {
    const [{ id }] = await sql`select request_id as id from hris.advances where number = 'KB-0001'`;
    const fin = await actorOf(ids.fin);
    expect(await engine.decideRequest(fin, id, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(id), fields: {} })).toMatchObject({ ok: false, status: 403 });
    expect(await engine.reviewRequest(fin, id, handlers, { expectedVersion: await versionOf(id), fields: { amount: 100_000, installments: 2 } })).toMatchObject({ ok: false, status: 400 });
    expect((await engine.reviewRequest(fin, id, handlers, { expectedVersion: await versionOf(id), fields: { amount: 100_000, installments: 2, note: 'Cukup seratus ribu dulu bulan ini' } })).ok).toBe(true);
    expect((await sql`select status from hris.requests where id = ${id}`)[0].status).toBe('REVIEWED');
    const owner = await actorOf(ids.owner);
    expect(await engine.decideRequest(owner, id, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(id), fields: { amount: 200_000, installments: 2, note: 'Naik dari pengajuan tidak boleh' } }))
      .toMatchObject({ ok: false });
    expect((await engine.decideRequest(owner, id, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(id), fields: { amount: 150_000, installments: 2 } })).ok).toBe(true);
    const row = await advanceOf(id);
    expect(row).toMatchObject({ state: 'APPROVED', final_amount: 150_000, final_installments: 2, without_review: false });
    const inst = await sql`select amount, period_start from hris.advance_installments where advance_id = ${row.id} order by sequence`;
    expect(inst.map((i) => [i.amount, i.period_start])).toEqual([[75_000, null], [75_000, null]]);
  });

  it('serah uang: penerima tidak menyerahkan sendiri; satu kali; jadwal dipasang ke periode tanggal uang', async () => {
    const [row] = await sql`select id from hris.advances where number = 'KB-0001'`;
    expect(await adv.handOver(await actorOf(ids.ani), row.id, { sourceId, moneyDate: '2026-11-10' }, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    const fin = await actorOf(ids.fin);
    expect(await adv.handOver(fin, row.id, { sourceId, moneyDate: '2026-11-11' }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
    // Sebelum tanggal disetujui (10 November) wajib alasan (spec L5 §9 butir 5).
    expect(await adv.handOver(fin, row.id, { sourceId, moneyDate: '2026-11-09' }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect((await adv.handOver(fin, row.id, { sourceId, moneyDate: '2026-11-10' }, noAnnounce)).ok).toBe(true);
    expect(await adv.handOver(fin, row.id, { sourceId, moneyDate: '2026-11-10' }, noAnnounce)).toMatchObject({ ok: false, status: 409 });
    const view = await viewOf(row.id);
    expect(view.stage).toBe('RUNNING');
    expect(view.remaining).toBe(150_000);
    expect(view.installments.filter((i) => i.status === 'SCHEDULED').map((i) => i.periodStart)).toEqual([P, NEXT]);
  });

  it('slip ditutup: cicilan terpotong (catatan SLIP), sisa berkurang; buka kembali membalik; batal serah lalu bisa', async () => {
    const [row] = await sql`select id from hris.advances where number = 'KB-0001'`;
    const owner = await actorOf(ids.owner);
    await slip.periodScreen(owner, P);
    const slipId = await slipIdOf(ids.ani);
    const closed = await slip.closeSlips(owner, { slipIds: [slipId], periodStart: null }, noAnnounce);
    expect(closed.ok && closed.data.outcomes[0].result).toBe('CLOSED');
    const [line] = await sql`select taken, remaining from hris.payslip_lines where payslip_id = ${slipId} and source_key like 'adv:%'`;
    expect(Number(line.taken) + Number(line.remaining)).toBe(75_000);
    let view = await viewOf(row.id);
    expect(view.remaining).toBe(150_000 - Number(line.taken));
    expect(view.movements.filter((m) => m.status === 'ACTIVE').reduce((s, m) => s + m.amount, 0)).toBe(Number(line.taken));
    expect(await adv.cancelHandover(owner, row.id, 'Tanggal uang salah ketik tadi', noAnnounce)).toMatchObject({ ok: false, status: 409 });

    expect((await slip.reopenSlip(owner, slipId, 'Salah hitung cicilan kasbon tadi', noAnnounce)).ok).toBe(true);
    view = await viewOf(row.id);
    expect(view.remaining).toBe(150_000);
    expect(view.installments.filter((i) => i.status === 'SCHEDULED').map((i) => i.periodStart)).toEqual([P, NEXT]);
    expect((await adv.cancelHandover(owner, row.id, 'Tanggal uang salah ketik tadi', noAnnounce)).ok).toBe(true);
    view = await viewOf(row.id);
    expect(view.stage).toBe('APPROVED');
    expect(view.installments.filter((i) => i.status === 'SCHEDULED').map((i) => i.periodStart)).toEqual([null, null]);
  });

  it('gaji tidak cukup: cicilan sebagian, sisa potongan kasbon dibawa dengan kunci sumbernya', async () => {
    const sub = await submit(ids.budi, { amount: 200_000, installments: 1 });
    expect(sub.ok).toBe(true);
    const requestId = sub.ok ? sub.data.id : 0;
    const owner2 = await actorOf(ids.owner2);
    expect((await engine.decideRequest(owner2, requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId), fields: {} })).ok).toBe(true);
    const row = await advanceOf(requestId);
    expect(row.without_review).toBe(true);
    expect((await adv.handOver(owner2, row.id, { sourceId, moneyDate: '2026-11-08', dateReason: 'Uang sudah diberikan dulu karena mendesak' }, noAnnounce)).ok).toBe(true);
    expect((await sql`select before_approval from hris.advance_handovers where advance_id = ${row.id}`)[0].before_approval).toBe(true);
    const owner = await actorOf(ids.owner);
    await slip.periodScreen(owner, P);
    const slipId = await slipIdOf(ids.budi);
    const closed = await slip.closeSlips(owner, { slipIds: [slipId], periodStart: null }, noAnnounce);
    expect(closed.ok && closed.data.outcomes[0].result).toBe('CLOSED');
    const [line] = await sql`select taken, remaining, source_key from hris.payslip_lines where payslip_id = ${slipId} and source_key like 'adv:%'`;
    expect(Number(line.remaining)).toBeGreaterThan(0);
    const [carry] = await sql`select amount, source_key, deduction_group from hris.deduction_carryovers where from_payslip_id = ${slipId} and source_key = ${line.source_key}`;
    expect(carry).toMatchObject({ deduction_group: 'd', amount: Number(line.remaining) });
    const view = await viewOf(row.id);
    expect(view.installments.find((i) => `adv:${i.id}` === line.source_key)?.status).toBe('PARTIAL');
    expect(view.remaining).toBe(200_000 - Number(line.taken));
  });

  it('Minta dibatalkan menahan serah uang; Pemilik menyetujui → kasbon Dibatalkan, cicilan batal', async () => {
    const [row] = await sql`select id from hris.advances where number = 'KB-0001'`;
    const ani = await actorOf(ids.ani);
    const asked = await engine.submitRequest(ani, 'advance_cancel', handlers.advance_cancel, { fields: { advanceId: row.id, reason: 'Sudah tidak jadi butuh uangnya' }, attachmentIds: [] });
    expect(asked.ok).toBe(true);
    expect(await adv.handOver(await actorOf(ids.fin), row.id, { sourceId, moneyDate: '2026-11-10' }, noAnnounce)).toMatchObject({ ok: false, status: 409 });
    const requestId = asked.ok ? asked.data.id : 0;
    expect((await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId), fields: {} })).ok).toBe(true);
    const view = await viewOf(row.id);
    expect(view.stage).toBe('CANCELLED');
    expect(view.installments.every((i) => i.status !== 'SCHEDULED')).toBe(true);
  });

  it('isikan atas nama: HR untuk orang lain boleh, untuk diri sendiri tidak; tidak memutuskan miliknya sendiri', async () => {
    const forBudi = await submit(ids.hr, { employeeId: ids.ani, amount: 50_000, installments: 1 });
    expect(forBudi.ok).toBe(true);
    const row = await advanceOf(forBudi.ok ? forBudi.data.id : 0);
    expect(row.employee_id).toBe(ids.ani);
    expect(row.filled_by_employee_id).toBe(ids.hr);
    // Pengajuan sendiri: isian nama orang lain diabaikan bila tidak berhak isikan atas nama.
    expect(await submit(ids.budi, { employeeId: ids.ani, amount: 50_000 })).toMatchObject({ ok: false, status: 403 });
    const own = await submit(ids.owner, { amount: 100_000, installments: 1 });
    expect(own.ok).toBe(true);
    const ownId = own.ok ? own.data.id : 0;
    expect(await engine.decideRequest(await actorOf(ids.owner), ownId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(ownId), fields: {} })).toMatchObject({ ok: false, status: 403 });
    expect((await engine.decideRequest(await actorOf(ids.owner2), ownId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(ownId), fields: {} })).ok).toBe(true);
  });
});
