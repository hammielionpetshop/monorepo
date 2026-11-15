import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L4c-1 Kehilangan Barang dan Minus Kas (spec L4c §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 27 November supaya periode itu sudah lewat.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4c1_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const PERIOD = '2026-10-26';
const NOW = new Date('2026-11-27T05:00:00Z');
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let losses: typeof import('./losses');
let shortages: typeof import('./cash-shortages');
let engine: typeof import('@/modules/requests');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'hr' | 'ani' | 'budi' | 'citra' | 'driver', number>;
let pusat: number;

async function upload(employeeId: number) {
  const id = randomUUID();
  await sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${id}, 'image/png', 10, 'x', ${employeeId + 1000})`;
  return id;
}

describe.skipIf(!ADMIN_URL)('L4c-1: Kehilangan Barang dan Minus Kas', () => {
  beforeAll(async () => {
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
    [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', -6.2, 106.8) returning id`;
    const person = async (name: string, position: string, from = '2026-01-01') => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, ${from}, 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${pos.id}, 'EMPLOYEE', ${from})`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), hr: await person('Nadia HR', 'HR'), ani: await person('Ani', 'Kepala Toko'),
      budi: await person('Budi', 'Kasir'), citra: await person('Citra', 'Pramuniaga', '2026-11-15'), driver: await person('Dodi', 'Driver'),
    };
    losses = await import('./losses');
    shortages = await import('./cash-shortages');
    engine = await import('@/modules/requests');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const lossInput = async (by: number, amount = 1_000_000, foundOn = '2026-11-20') => ({ branchId: pusat, foundOn, amount, description: 'Hasil opname November: makanan kucing', attachmentId: await upload(by) });

  it('kehilangan ditolak sebelum cabang punya persen kantor', async () => {
    const result = await losses.recordLossDirect(await actorOf(ids.owner), await lossInput(ids.owner), noAnnounce, NOW);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('persen kantor');
  });

  it('pembagian: jabatan bertanda saja, bobot × hari; Pemilik dan Driver tidak ikut', async () => {
    await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
      values ('payroll.loss_office_percent', 'BRANCH', ${pusat}, '40'::jsonb, ${PERIOD}, 'ACTIVE', 'Uji persen kantor')`;
    const split = await losses.lossSplitOf(pusat, '2026-11-20', 1_000_000);
    // Periode 31 hari. Ani Kepala Toko bobot 2 penuh, Budi bobot 1 penuh, Citra bobot 1 mulai 15 Nov (11 hari).
    expect(split?.shares.map((s) => [s.name, s.weight, s.days, s.amount])).toEqual([
      ['Ani', 2, 31, 300_000], ['Budi', 1, 31, 150_000], ['Citra', 1, 11, 53_226],
    ]);
    expect(split!.shares.reduce((s, x) => s + x.amount, 0) + split!.office.total).toBe(1_000_000);
  });

  it('Pemilik mencatat langsung: berlaku, yang menanggung diberi tahu bagiannya', async () => {
    const result = await losses.recordLossDirect(await actorOf(ids.owner), await lossInput(ids.owner), noAnnounce, NOW);
    expect(result.ok).toBe(true);
    const [row] = await sql`select status from hris.inventory_losses where id = ${result.ok ? result.data.id : 0}`;
    expect(row.status).toBe('ACTIVE');
    const notes = await sql`select recipient_account_id, body from hris.notifications where kind = 'inventory_loss.active' order by recipient_account_id`;
    expect(notes.map((n) => n.recipient_account_id)).toEqual([ids.ani + 1000, ids.budi + 1000, ids.citra + 1000]);
    expect(notes[0].body).toContain('Rp300.000');
  });

  it('HR mengusulkan, Pemilik mengesahkan lewat Persetujuan; HR tidak bisa mencatat langsung', async () => {
    const hr = await actorOf(ids.hr);
    expect((await losses.recordLossDirect(hr, await lossInput(ids.hr), noAnnounce, NOW)).ok).toBe(false);
    const handlers = { inventory_loss: losses.inventoryLossHandler(noAnnounce) as unknown as RequestHandler };
    // Usulan memakai tanggal hari ini yang sebenarnya untuk "masa depan"; pakai tanggal yang pasti lampau.
    const input = await lossInput(ids.hr, 500_000, '2026-11-01');
    const submitted = await engine.submitRequest(hr, 'inventory_loss', handlers.inventory_loss, { fields: input, attachmentIds: [input.attachmentId] });
    expect(submitted.ok ? null : submitted.error).toBeNull();
    const requestId = submitted.ok ? submitted.data.id : 0;
    expect((await sql`select status from hris.inventory_losses where request_id = ${requestId}`)[0].status).toBe('PENDING');
    const [{ version }] = await sql`select version from hris.requests where id = ${requestId}`;
    const decided = await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: Number(version) });
    expect(decided.ok).toBe(true);
    expect((await sql`select status from hris.inventory_losses where request_id = ${requestId}`)[0].status).toBe('ACTIVE');
  });

  it('Batalkan oleh Pemilik dengan alasan; catatan tidak bisa dihapus', async () => {
    const [row] = await sql`select id from hris.inventory_losses where status = 'ACTIVE' order by id limit 1`;
    expect((await losses.cancelLoss(await actorOf(ids.hr), row.id, 'Salah input nilai opname', noAnnounce)).ok).toBe(false);
    expect((await losses.cancelLoss(await actorOf(ids.owner), row.id, 'Salah input nilai opname', noAnnounce)).ok).toBe(true);
    await expect(sql`delete from hris.inventory_losses where id = ${row.id}`).rejects.toThrow();
  });

  it('minus kas POS: salin dari view sama dengan laporan Minus Kasir, idempoten, menunggu tautan', async () => {
    const [{ id: kasirBranch }] = await sql`insert into petshop.branches (code, name) values ('PST', 'Toko Pusat') returning id`;
    const [{ id: aniPos }] = await sql`insert into petshop.users (name, username) values ('Ani', 'ani') returning id`;
    const [{ id: budiPos }] = await sql`insert into petshop.users (name, username) values ('Budi', 'budi') returning id`;
    await sql`insert into petshop.payment_methods (name, type) values ('Tunai', 'CASH')`;
    const shift = async (number: number, expected: number, received: number, cash: [number, number][]) => {
      const [{ id }] = await sql`insert into petshop.shifts (shift_number, branch_id, status, opened_at, closed_at, total_closing_cash_expected, deposit_received_cash, deposit_verified_at)
        values (${number}, ${kasirBranch}, 'CLOSED', '2026-11-02 01:00', '2026-11-02 10:00', ${expected}, ${received}, '2026-11-02 12:00') returning id`;
      for (const [user, amount] of cash) await sql`insert into petshop.shift_cashier_breakdown (shift_id, cashier_id, total_sales_cash) values (${id}, ${user}, ${amount})`;
    };
    await shift(1, 1_000_000, 940_000, [[aniPos, 600_000], [budiPos, 400_000]]); // minus 60.000: Ani 36.000, Budi 24.000
    await shift(2, 500_000, 510_000, [[aniPos, 500_000]]); // lebih 10.000 untuk Ani
    await shift(3, 3_000_000, 1_000_000, [[aniPos, 3_000_000]]); // tak wajar, tidak pernah dipotong
    const first = await shortages.syncCashShortages(NOW);
    expect(first).toMatchObject({ shifts: 3, inserted: 4, proposals: 0 });
    const again = await shortages.syncCashShortages(NOW);
    expect(again).toMatchObject({ inserted: 0, updated: 0, proposals: 0 });
    const rows = await sql`select pos_user_id, category, amount from hris.cash_shortages order by pos_shift_id, pos_user_id`;
    expect(rows.map((r) => [Number(r.pos_user_id), r.category, r.amount])).toEqual([
      [aniPos, 'MINUS', -36_000], [budiPos, 'MINUS', -24_000], [aniPos, 'PLUS', 10_000], [aniPos, 'ANOMALY', 0],
    ]);
    const hr = await actorOf(ids.hr);
    expect((await shortages.linkPosUser(hr, aniPos, ids.ani)).ok).toBe(true);
    expect((await shortages.linkPosUser(hr, aniPos, ids.budi)).ok).toBe(false);
    expect((await shortages.linkPosUser(hr, budiPos, ids.budi)).ok).toBe(true);
    expect((await shortages.syncCashShortages(NOW)).proposals).toBe(2);
    expect((await shortages.syncCashShortages(NOW)).proposals).toBe(0);
  });

  it('HR meninjau, Pemilik mengesahkan; minus dikurangi lebih, shift ditiadakan tidak dihitung', async () => {
    const [ani] = await sql`select id from hris.cash_shortage_approvals where employee_id = ${ids.ani}`;
    const [budi] = await sql`select id from hris.cash_shortage_approvals where employee_id = ${ids.budi}`;
    expect((await shortages.approveApproval(await actorOf(ids.hr), ani.id, [], noAnnounce, NOW)).ok).toBe(false);
    expect((await shortages.reviewApproval(await actorOf(ids.hr), ani.id, noAnnounce)).ok).toBe(true);
    const approved = await shortages.approveApproval(await actorOf(ids.owner), ani.id, [], noAnnounce, NOW);
    expect(approved.ok && approved.data.net).toBe(26_000);
    const [budiRow] = await sql`select id from hris.cash_shortages where approval_id = ${budi.id}`;
    const waived = await shortages.approveApproval(await actorOf(ids.owner), budi.id, [{ rowId: budiRow.id, reason: 'Salah hitung uang di laci' }], noAnnounce, NOW);
    expect(waived.ok && waived.data.net).toBe(0);
    const amounts = await shortages.shortageAmountsOf(ids.ani, PERIOD);
    expect(amounts.pos).toEqual({ minus: 36_000, plus: 10_000, net: 26_000 });
  });

  it('minus kas catat tangan: tanpa nama ditolak bila tidak ada yang hadir; bernama langsung berlaku', async () => {
    const owner = await actorOf(ids.owner);
    const base = { branchId: pusat, occurredOn: '2026-11-10', amount: 90_000, reason: 'Uang kembalian titipan pelanggan hilang dari laci', attachmentId: null };
    const unnamed = await shortages.recordManualDirect(owner, { ...base, namedEmployeeId: null }, noAnnounce, NOW);
    expect(!unnamed.ok && unnamed.error).toContain('Tidak ada yang hadir');
    expect((await shortages.recordManualDirect(owner, { ...base, namedEmployeeId: ids.owner }, noAnnounce, NOW)).ok).toBe(false);
    const named = await shortages.recordManualDirect(owner, { ...base, namedEmployeeId: ids.budi }, noAnnounce, NOW);
    expect(named.ok).toBe(true);
    const shares = await sql`select employee_id, amount from hris.manual_cash_shortage_shares`;
    expect(shares.map((s) => [s.employee_id, s.amount])).toEqual([[ids.budi, 90_000]]);
  });
});
