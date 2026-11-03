import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L5b Kasbon sesudah diberikan (spec L5 §8, kriteria PRD 07 §4) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l5b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const NOW = new Date('2026-11-10T05:00:00Z');
const P = '2026-10-26';
const NEXT = '2026-11-26';
const NEXT2 = '2026-12-26';
const NEXT3 = '2027-01-26';
const REASON = 'Biaya berobat anak di puskesmas';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'hr' | 'fin' | 'ani' | 'budi' | 'siti' | 'dodi' | 'eko' | 'baru', number>;
let handlers: Record<string, RequestHandler>;
let adv: typeof import('@/modules/advances');
let engine: typeof import('@/modules/requests');
let slip: typeof import('@/modules/payroll');
let sourceId: number;
let driverId: number;

describe.skipIf(!ADMIN_URL)('L5b: Kasbon sesudah diberikan', () => {
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
      ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir', '2026-01-01', 60_000), siti: await person('Siti', 'Kasir'),
      dodi: await person('Dodi', 'Kasir'), eko: await person('Eko', 'Kasir', '2026-01-01', 60_000), baru: await person('Baru', 'Kasir', '2026-08-01'),
    };
    [{ id: sourceId }] = await sql`select id from hris.payment_sources order by id limit 1`;
    [{ id: driverId }] = await sql`select id from hris.positions where name = 'Driver'`;
    adv = await import('@/modules/advances');
    engine = await import('@/modules/requests');
    slip = await import('@/modules/payroll');
    handlers = {
      advance: adv.advanceHandler(), advance_cancel: adv.advanceCancelHandler(noAnnounce), advance_not_received: adv.advanceNotReceivedHandler(),
      advance_postpone: adv.advancePostponeHandler(),
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

  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const viewOf = async (id: number) => (await adv.loadAdvances({ ids: [id] }))[0];
  const waiting = async (id: number) => (await viewOf(id)).installments.filter((i) => i.status === 'SCHEDULED' || i.status === 'WAITING_WEEKLY')
    .map((i) => [i.periodStart, i.amount, i.status]);
  /** Ajukan → Pemilik menyetujui (tanpa Finance) → Finance menyerahkan; mengembalikan id kasbon. */
  const give = async (employeeId: number, amount: number, installments: number) => {
    const sub = await engine.submitRequest(await actorOf(employeeId), 'advance', handlers.advance, { fields: { reason: REASON, amount, installments }, attachmentIds: [] });
    if (!sub.ok) throw new Error(sub.error);
    const requestId = sub.data.id;
    const decided = await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId), fields: {} });
    if (!decided.ok) throw new Error(decided.error);
    const [row] = await sql`select id from hris.advances where request_id = ${requestId}`;
    const handed = await adv.handOver(await actorOf(ids.fin), row.id, { sourceId, moneyDate: '2026-11-10' }, noAnnounce);
    if (!handed.ok) throw new Error(handed.error);
    return Number(row.id);
  };
  const close = async (employeeId: number, period: string) => {
    const owner = await actorOf(ids.owner);
    await slip.periodScreen(owner, period);
    const [{ id }] = await sql`select id from hris.payslips where employee_id = ${employeeId} and period_start = ${period}`;
    const closed = await slip.closeSlips(owner, { slipIds: [Number(id)], periodStart: null }, noAnnounce);
    expect(closed.ok && closed.data.outcomes[0].result).toBe('CLOSED');
    return Number(id);
  };
  const postpone = async (actorId: number, advanceId: number) =>
    engine.submitRequest(await actorOf(actorId), 'advance_postpone', handlers.advance_postpone, { fields: { advanceId, reason: 'Bulan ini banyak keperluan sekolah anak' }, attachmentIds: [] });

  it('tunda gugur: slip cicilan terdekat ditutup sebelum diputuskan → cicilan terpotong biasa, jatah tidak terpakai', async () => {
    const id = await give(ids.siti, 100_000, 1);
    const asked = await postpone(ids.siti, id);
    expect(asked.ok).toBe(true);
    await close(ids.siti, P);
    expect((await sql`select status from hris.requests where id = ${asked.ok ? asked.data.id : 0}`)[0].status).toBe('EXPIRED');
    const view = await viewOf(id);
    expect(view.stage).toBe('PAID_OFF');
  });

  it('PRD 07 §4: satu kasbon lunas lewat dua slip bulanan dengan tunda sekali (jatah 1 kali)', async () => {
    const id = await give(ids.ani, 150_000, 2);
    expect(await waiting(id)).toEqual([[P, 75_000, 'SCHEDULED'], [NEXT, 75_000, 'SCHEDULED']]);
    // Orang lain (bukan HR) tidak bisa meminta tunda untuk kasbon Ani.
    expect(await postpone(ids.budi, id)).toMatchObject({ ok: false, status: 404 });
    const asked = await postpone(ids.ani, id);
    expect(asked.ok).toBe(true);
    expect(await postpone(ids.ani, id)).toMatchObject({ ok: false });
    const requestId = asked.ok ? asked.data.id : 0;
    expect(await engine.decideRequest(await actorOf(ids.ani), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId), fields: {} }))
      .toMatchObject({ ok: false });
    expect((await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId), fields: {} })).ok).toBe(true);
    expect(await waiting(id)).toEqual([[NEXT, 75_000, 'SCHEDULED'], [NEXT2, 75_000, 'SCHEDULED']]);
    expect(await postpone(ids.ani, id)).toMatchObject({ ok: false, error: expect.stringContaining('sudah pernah ditunda') });

    const p = await close(ids.ani, P);
    expect((await sql`select count(*)::int as n from hris.payslip_lines where payslip_id = ${p} and source_key like 'adv:%'`)[0].n).toBe(0);
    // Slip periode depan baru ada saat periodenya tiba: jam uji dimajukan lalu dikembalikan.
    vi.setSystemTime(new Date('2026-12-10T05:00:00Z'));
    await close(ids.ani, NEXT);
    expect((await viewOf(id)).remaining).toBe(75_000);
    vi.setSystemTime(new Date('2027-01-10T05:00:00Z'));
    await close(ids.ani, NEXT2);
    vi.setSystemTime(NOW);
    const view = await viewOf(id);
    expect(view.stage).toBe('PAID_OFF');
    expect(view.remaining).toBe(0);
  });

  it('pelunasan tunai sebagian lalu dibatalkan; Finance tidak membatalkan; hapus utang sebagian', async () => {
    const id = await give(ids.dodi, 200_000, 2);
    const fin = await actorOf(ids.fin);
    expect(await adv.repayAdvance(await actorOf(ids.dodi), id, { amount: 50_000, sourceId, moneyDate: '2026-11-10' }, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await adv.repayAdvance(fin, id, { amount: 250_000, sourceId, moneyDate: '2026-11-10' }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await adv.repayAdvance(fin, id, { amount: 120_000, sourceId, moneyDate: '2026-11-09' }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect((await adv.repayAdvance(fin, id, { amount: 120_000, sourceId, moneyDate: '2026-11-10' }, noAnnounce)).ok).toBe(true);
    let view = await viewOf(id);
    expect(view.remaining).toBe(80_000);
    expect(await waiting(id)).toEqual([[NEXT, 80_000, 'SCHEDULED']]);
    const [cash] = view.movements.filter((m) => m.kind === 'CASH');
    expect(await adv.reverseMovement(fin, id, cash.id, 'Salah catat nominal pelunasan', noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect((await adv.reverseMovement(await actorOf(ids.owner), id, cash.id, 'Salah catat nominal pelunasan', noAnnounce)).ok).toBe(true);
    view = await viewOf(id);
    expect(view.remaining).toBe(200_000);
    expect(await waiting(id)).toEqual([[NEXT, 200_000, 'SCHEDULED']]);

    expect(await adv.writeOffAdvance(fin, id, { amount: 50_000, reason: 'Keringanan karena musibah keluarga' }, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await adv.writeOffAdvance(await actorOf(ids.dodi), id, { amount: 50_000, reason: 'Keringanan karena musibah keluarga' }, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect((await adv.writeOffAdvance(await actorOf(ids.owner), id, { amount: 50_000, reason: 'Keringanan karena musibah keluarga' }, noAnnounce)).ok).toBe(true);
    expect((await viewOf(id)).remaining).toBe(150_000);
    expect(await waiting(id)).toEqual([[NEXT, 150_000, 'SCHEDULED']]);
  });

  it('ubah jadwal: jumlah tetap, banyaknya ≤ 3, gajian mulai tidak di slip ditutup / terlalu jauh', async () => {
    const [{ id }] = await sql`select id from hris.advances where employee_id = ${ids.dodi}`;
    const owner = await actorOf(ids.owner);
    await close(ids.dodi, P);
    expect(await adv.rescheduleAdvance(owner, id, { count: 4, start: NEXT, reason: 'Gaji Dodi bulan depan kecil' })).toMatchObject({ ok: false, status: 400 });
    expect(await adv.rescheduleAdvance(owner, id, { count: 3, start: P, reason: 'Gaji Dodi bulan depan kecil' })).toMatchObject({ ok: false, status: 400 });
    expect(await adv.rescheduleAdvance(owner, id, { count: 3, start: '2027-03-26', reason: 'Gaji Dodi bulan depan kecil' })).toMatchObject({ ok: false, status: 400 });
    expect((await adv.rescheduleAdvance(owner, id, { count: 3, start: NEXT, reason: 'Gaji Dodi bulan depan kecil' })).ok).toBe(true);
    expect(await waiting(id)).toEqual([[NEXT, 50_000, 'SCHEDULED'], [NEXT2, 50_000, 'SCHEDULED'], [NEXT3, 50_000, 'SCHEDULED']]);
  });

  it('DRV-140 ganti slip utama ke Mingguan: cicilan sesudah tanggal pindah dipasang ke minggu upah; dibatalkan → kembali bulanan', async () => {
    const [{ id }] = await sql`select id from hris.advances where employee_id = ${ids.dodi}`;
    const [{ branch_id: branchId }] = await sql`select branch_id from hris.placements where employee_id = ${ids.dodi}`;
    const [placement] = await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from, reason, created_by_account_id)
      values (${ids.dodi}, 'POSITION', ${branchId}, ${driverId}, 'EMPLOYEE', ${NEXT2}, 'Pindah menjadi driver', 1) returning id`;
    expect(await adv.syncMainSlip(ids.dodi)).toBe(2);
    // Pindah 26 Des (Sabtu): minggu pertama yang dimulai pada/sesudah itu = Jumat 1 Jan 2027; banyak dan nominal tetap.
    expect(await waiting(id)).toEqual([[NEXT, 50_000, 'SCHEDULED'], ['2027-01-01', 50_000, 'SCHEDULED'], ['2027-01-08', 50_000, 'SCHEDULED']]);
    expect((await viewOf(id)).installments.filter((i) => i.status === 'SCHEDULED').map((i) => i.slipKind)).toEqual(['MONTHLY', 'WEEKLY', 'WEEKLY']);
    expect(await adv.syncMainSlip(ids.dodi)).toBe(0);
    expect((await adv.repayAdvance(await actorOf(ids.fin), id, { amount: 60_000, sourceId, moneyDate: '2026-11-10' }, noAnnounce)).ok).toBe(true);
    expect((await viewOf(id)).remaining).toBe(90_000);
    await sql`update hris.placements set cancelled_at = now(), cancelled_by_account_id = 1, cancel_reason = 'Batal pindah jabatan' where id = ${placement.id}`;
    expect(await adv.syncMainSlip(ids.dodi)).toBeGreaterThan(0);
    // Pelunasan 60.000 menghabiskan cicilan 26 Nov lalu 10.000 dari minggu 1 Jan; sisanya kembali ke slip bulanan 26 Des, 26 Jan.
    expect(await waiting(id)).toEqual([[NEXT2, 40_000, 'SCHEDULED'], [NEXT3, 50_000, 'SCHEDULED']]);
    expect((await viewOf(id)).installments.filter((i) => i.status === 'SCHEDULED').every((i) => i.slipKind === 'MONTHLY')).toBe(true);
  });

  it('pelunasan memakai sisa potongan yang dibawa lebih dulu; lunas', async () => {
    const id = await give(ids.budi, 100_000, 1);
    const slipId = await close(ids.budi, P);
    const [carry] = await sql`select id, amount from hris.deduction_carryovers where from_payslip_id = ${slipId} and source_key like 'adv:%' and status = 'CARRIED'`;
    expect(Number(carry.amount)).toBeGreaterThan(0);
    const before = await viewOf(id);
    expect(before.remaining).toBe(Number(carry.amount));
    expect((await adv.repayAdvance(await actorOf(ids.fin), id, { amount: before.remaining, sourceId, moneyDate: '2026-11-10' }, noAnnounce)).ok).toBe(true);
    expect((await sql`select status from hris.deduction_carryovers where id = ${carry.id}`)[0].status).toBe('CANCELLED');
    expect((await viewOf(id)).stage).toBe('PAID_OFF');
  });

  it('slip terakhir: sisa dialihkan ke Piutang Lain (pelunasan ditolak); buka kembali membalik', async () => {
    const id = await give(ids.eko, 200_000, 2);
    await sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, resignation_notice, note, created_by_account_id)
      values (${ids.eko}, 'DEACTIVATE', '2026-11-20', 'RESIGNED', 'WITH_NOTICE', 'Mengundurkan diri', 1)`;
    // Sejak tanggal berhenti tercatat: tunda ditolak.
    expect(await postpone(ids.eko, id)).toMatchObject({ ok: false, error: expect.stringContaining('berhenti') });
    const slipId = await close(ids.eko, P);
    let view = await viewOf(id);
    expect(view.stage).toBe('TRANSFERRED');
    expect((await sql`select count(*)::int as n from hris.other_receivables where payslip_id = ${slipId} and deduction_group = 'd'`)[0].n).toBe(1);
    expect(await adv.repayAdvance(await actorOf(ids.fin), id, { amount: 10_000, sourceId, moneyDate: '2026-11-10' }, noAnnounce)).toMatchObject({ ok: false, status: 409 });
    expect((await slip.reopenSlip(await actorOf(ids.owner), slipId, 'Salah tanggal berhenti karyawan', noAnnounce)).ok).toBe(true);
    view = await viewOf(id);
    expect(view.stage).toBe('RUNNING');
    expect(view.remaining).toBe(200_000);
  });

  it('Kasbon Khusus: melewati 6 bulan, batas orang, dan dana; tidak dihitung terpakai; bukan untuk diri sendiri', async () => {
    const owner = await actorOf(ids.owner);
    const input = { employeeId: ids.baru, eventKind: 'Kecelakaan', reason: 'Biaya rumah sakit karena kecelakaan motor', amount: 1_500_000, installments: 6 };
    expect(await adv.createSpecialAdvance(await actorOf(ids.fin), input, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await adv.createSpecialAdvance(owner, { ...input, employeeId: ids.owner }, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await adv.createSpecialAdvance(owner, { ...input, eventKind: 'Liburan' }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await adv.createSpecialAdvance(owner, { ...input, installments: 13 }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
    const made = await adv.createSpecialAdvance(owner, input, noAnnounce);
    expect(made.ok).toBe(true);
    const id = made.ok ? made.data.id! : 0;
    let view = await viewOf(id);
    expect(view).toMatchObject({ stage: 'APPROVED', used: 0 });
    expect(view.row).toMatchObject({ kind: 'SPECIAL', requestId: null, eventKind: 'Kecelakaan' });
    expect((await adv.handOver(await actorOf(ids.fin), id, { sourceId, moneyDate: '2026-11-10' }, noAnnounce)).ok).toBe(true);
    view = await viewOf(id);
    expect(view.stage).toBe('RUNNING');
    expect(view.used).toBe(0);
    expect(view.installments.filter((i) => i.status === 'SCHEDULED')).toHaveLength(6);
  });

  it('Uang Kasbon: uang keluar, pelunasan aktif, dan utang dihapus bulan ini; HR tidak melihat; CSV', async () => {
    const screen = await (await import('./screens')).moneyScreen(await actorOf(ids.owner), '2026-11');
    expect(screen).not.toBeNull();
    expect(screen!.totals.writeOff).toBe(50_000);
    expect(screen!.rows.some((r) => r.kind === 'OUT' && r.amount === 1_500_000)).toBe(true);
    expect(screen!.rows.filter((r) => r.kind === 'IN').every((r) => r.amount !== 120_000)).toBe(true);
    expect(await (await import('./screens')).moneyScreen(await actorOf(ids.hr), '2026-11')).toBeNull();
    const csv = await adv.moneyCsv(await actorOf(ids.fin), '2026-11');
    expect(csv?.csv.split('\r\n')[0]).toContain('Sumber uang');
  });
});
