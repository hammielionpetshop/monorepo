import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L4d-1 Buku Bonus grooming dan ongkir (spec L4d §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4d1_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const PERIOD = '2026-10-26';
const NOW = new Date('2026-11-10T05:00:00Z');
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let bonus: typeof import('./bonus');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'gm' | 'hr' | 'rina' | 'sari' | 'budi' | 'dodi', number>;
let pos: Record<'rina' | 'sari' | 'budi' | 'dodi' | 'lepas' | 'owner' | 'gm', number>;
let kasirBranch: number;

/** Satu nota kasir dengan satu baris jasa/ongkir (dan baris lain bila ada diskon nota). */
async function nota(lineTotal: number, payable = lineTotal, other = 0, createdAt = '2026-10-28 03:00:00') {
  const [trx] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at) values (${`TRX-${Math.random().toString(36).slice(2, 8)}`}, ${payable}, ${createdAt}) returning id, trx_number`;
  const [item] = await sql`insert into petshop.transaction_items (transaction_id, product_name, total_price) values (${trx.id}, 'Mandi kucing', ${lineTotal}) returning id`;
  if (other) await sql`insert into petshop.transaction_items (transaction_id, product_name, total_price) values (${trx.id}, 'Pakan', ${other})`;
  return { trxId: Number(trx.id), itemId: Number(item.id) };
}
async function grooming(groomerId: number, lineTotal: number, opts: { payable?: number; other?: number; pickedUpAt?: string | null } = {}) {
  const n = await nota(lineTotal, opts.payable, opts.other);
  const picked = opts.pickedUpAt === undefined ? '2026-10-28 05:00:00' : opts.pickedUpAt;
  const [row] = await sql`insert into petshop.grooming_orders (branch_id, transaction_id, transaction_item_id, groomer_id, status, picked_up_at)
    values (${kasirBranch}, ${n.trxId}, ${n.itemId}, ${groomerId}, ${picked ? 'DIAMBIL' : 'DIKERJAKAN'}, ${picked}) returning id`;
  return { ...n, id: Number(row.id) };
}
async function delivery(courierId: number, lineTotal: number, free = false) {
  const n = await nota(lineTotal);
  const [row] = await sql`insert into petshop.service_deliveries (branch_id, transaction_id, transaction_item_id, courier_id, address, is_free_shipping, status)
    values (${kasirBranch}, ${n.trxId}, ${n.itemId}, ${courierId}, 'Jl. Melati', ${free}, 'SELESAI') returning id`;
  return { ...n, id: Number(row.id) };
}
const entries = (kind?: string) => sql`select * from hris.bonus_entries where (${kind ?? null}::text is null or kind = ${kind ?? null}) order by id`;

describe.skipIf(!ADMIN_URL)('L4d-1: Buku Bonus grooming dan ongkir', () => {
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
    [{ id: kasirBranch }] = await sql`insert into petshop.branches (code, name) values ('TP', 'Toko Pusat') returning id`;
    const [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', -6.2, 106.8) returning id`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), gm: await person('Gina', 'GM'), hr: await person('Nadia HR', 'HR'), rina: await person('Rina', 'Groomer'),
      sari: await person('Sari', 'Groomer'), budi: await person('Budi', 'Kasir'), dodi: await person('Dodi', 'Driver'),
    };
    const groomer = async (name: string) => Number((await sql`insert into petshop.groomers (name, is_courier) values (${name}, true) returning id`)[0].id);
    pos = {
      rina: await groomer('Rina'), sari: await groomer('Sari'), budi: await groomer('Budi'), dodi: await groomer('Dodi'),
      lepas: await groomer('Pak Lepas'), owner: await groomer('Elan'), gm: await groomer('Gina'),
    };
    bonus = await import('./bonus');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const link = async (posGroomerId: number, employeeId: number | null, notEmployee = false) =>
    bonus.linkGroomer(await actorOf(ids.owner), { posGroomerId, employeeId, notEmployee, note: notEmployee ? 'Pekerja lepas akhir pekan' : null }, noAnnounce);

  it('hanya Pemilik/GM memasangkan; bonus yang belum dipasangkan menunggu dan tidak hilang', async () => {
    await grooming(pos.rina, 85_000);
    expect((await bonus.syncBonuses()).unpaired).toBe(1);
    expect(await entries()).toHaveLength(0);
    const hr = await bonus.linkGroomer(await actorOf(ids.hr), { posGroomerId: pos.rina, employeeId: ids.rina, notEmployee: false, note: null }, noAnnounce);
    expect(hr).toMatchObject({ ok: false, status: 403 });
    expect(await link(pos.rina, ids.rina)).toMatchObject({ ok: true });
    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ employee_id: ids.rina, status: 'PENDING', amount: 8500, percent: 10 });
    expect(new Date(rows[0].period_start).toISOString().slice(0, 10)).toBe(PERIOD);
    expect(await link(pos.rina, ids.sari)).toMatchObject({ ok: false, status: 409 });
  });

  it('nominal sama dengan laporan kasir; penerima di luar jabatan Ditahan; ongkir Disahkan; GM, gratis ongkir, dan bukan karyawan tanpa baris', async () => {
    await grooming(pos.rina, 60_000, { payable: 180_000, other: 140_000 });
    await grooming(pos.rina, 50_000, { pickedUpAt: null });
    await grooming(pos.budi, 70_000);
    await delivery(pos.dodi, 15_000);
    await delivery(pos.dodi, 10_000, true);
    await delivery(pos.gm, 15_000);
    await grooming(pos.lepas, 90_000);
    for (const [g, e] of [[pos.budi, ids.budi], [pos.dodi, ids.dodi], [pos.gm, ids.gm], [pos.sari, ids.sari], [pos.owner, ids.owner]] as const) await link(g, e);
    expect(await link(pos.lepas, null, true)).toMatchObject({ ok: true });
    const grooms = await entries('GROOMING');
    expect(grooms.map((r) => [r.employee_id, r.amount, r.status])).toEqual([[ids.rina, 8500, 'PENDING'], [ids.rina, 5400, 'PENDING'], [ids.budi, 7000, 'HELD']]);
    const deliveries = await entries('DELIVERY');
    expect(deliveries.map((r) => [r.employee_id, r.amount, r.status])).toEqual([[ids.dodi, 7500, 'APPROVED']]);
  });

  it('idempoten: dua kali tarik tanpa perubahan kasir = tanpa tulisan baru', async () => {
    const before = (await entries()).length;
    const result = await bonus.syncBonuses();
    expect(result).toMatchObject({ created: 0, updated: 0, replaced: 0, cancelled: 0, flagged: 0 });
    expect(await entries()).toHaveLength(before);
  });

  it('ganti groomer sebelum disahkan: baris lama batal, baris baru bertanda ⚠', async () => {
    const g = await grooming(pos.rina, 100_000);
    await bonus.syncBonuses();
    await sql`update petshop.grooming_orders set groomer_id = ${pos.sari} where id = ${g.id}`;
    await sql`insert into petshop.grooming_groomer_changes (grooming_order_id) values (${g.id})`;
    expect((await bonus.syncBonuses()).replaced).toBe(1);
    const rows = await sql`select * from hris.bonus_entries where origin_key = ${`GROOMING:${g.id}`} order by id`;
    expect(rows.map((r) => [r.employee_id, r.status, r.flag])).toEqual([[ids.rina, 'CANCELLED', null], [ids.sari, 'PENDING', 'GROOMER_CHANGED']]);
  });

  it('pengesahan per groomer: baris ⚠ dulu satu per satu, tepat daftar yang tampil, bukan bonus sendiri', async () => {
    const hr = await actorOf(ids.hr);
    const sari = (await entries('GROOMING')).filter((r) => r.employee_id === ids.sari && r.status === 'PENDING');
    expect(await bonus.approveGrooming(await actorOf(ids.sari), sari.map((r) => r.id), noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await bonus.approveGrooming(hr, sari.map((r) => r.id), noAnnounce)).toMatchObject({ ok: true, data: { total: 10_000, count: 1 } });
    const rina = (await entries('GROOMING')).filter((r) => r.employee_id === ids.rina && r.status === 'PENDING');
    expect(await bonus.approveGrooming(hr, [...rina.map((r) => r.id), sari[0].id], noAnnounce)).toMatchObject({ ok: false, status: 409 });
    expect(await bonus.approveGrooming(hr, rina.map((r) => r.id), noAnnounce)).toMatchObject({ ok: true, data: { total: 13_900, count: 2 } });
    const late = await grooming(pos.rina, 20_000);
    await bonus.syncBonuses();
    const [fresh] = await sql`select status from hris.bonus_entries where origin_key = ${`GROOMING:${late.id}`}`;
    expect(fresh.status).toBe('PENDING');
  });

  it('bonus jabatan Pemilik: tidak terlihat dan tidak diputus HR', async () => {
    await grooming(pos.owner, 80_000);
    await bonus.syncBonuses();
    const [own] = await sql`select * from hris.bonus_entries where employee_id = ${ids.owner}`;
    expect(own).toMatchObject({ status: 'PENDING', amount: 8000 });
    const hr = await actorOf(ids.hr);
    expect(await bonus.approveGrooming(hr, [own.id], noAnnounce)).toMatchObject({ ok: false, status: 403 });
    const screen = await bonus.bonusApprovalScreen(hr, { period: PERIOD });
    expect(screen!.grooming.some((g) => g.employeeId === ids.owner)).toBe(false);
    expect(await bonus.approveGrooming(await actorOf(ids.gm), [own.id], noAnnounce)).toMatchObject({ ok: true });
  });

  it('berubah di kasir sesudah disahkan: daftar periksa, Terima perubahan → koreksi minus di kelompok (c), tidak ditandai ulang', async () => {
    const [approved] = await sql`select * from hris.bonus_entries where employee_id = ${ids.rina} and status = 'APPROVED' and amount = 8500`;
    const [order] = await sql`select transaction_item_id from petshop.grooming_orders where id = ${approved.pos_ref_id}`;
    await sql`update petshop.transaction_items set total_price = 70000 where id = ${order.transaction_item_id}`;
    await sql`update petshop.transactions t set payable_amount = 70000 from petshop.transaction_items i where i.id = ${order.transaction_item_id} and t.id = i.transaction_id`;
    expect((await bonus.syncBonuses()).flagged).toBe(1);
    expect((await bonus.syncBonuses()).flagged).toBe(0);
    const [change] = await sql`select * from hris.bonus_pos_changes where entry_id = ${approved.id}`;
    expect(change.status).toBe('OPEN');
    const hr = await actorOf(ids.hr);
    expect(await bonus.decidePosChange(hr, change.id, true, '', noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await bonus.decidePosChange(hr, change.id, true, 'Harga jasa dikoreksi kasir', noAnnounce)).toMatchObject({ ok: true });
    const corrections = await sql`select * from hris.bonus_entries where flag = 'CORRECTION'`;
    expect(corrections.map((r) => [r.employee_id, r.amount, r.status])).toEqual([[ids.rina, -1500, 'APPROVED']]);
    expect((await bonus.bonusesOf(ids.rina, PERIOD)).minusCorrections).toEqual([expect.objectContaining({ amount: 1500 })]);
    expect((await bonus.syncBonuses()).flagged).toBe(0);
  });

  it('ongkir dibatalkan dengan alasan; batal di kasir sesudahnya tidak menulis apa-apa', async () => {
    const [row] = await entries('DELIVERY');
    const hr = await actorOf(ids.hr);
    expect(await bonus.rejectOrCancelBonus(hr, row.id, 'Pengantar salah ketik di kasir', noAnnounce)).toMatchObject({ ok: true });
    await sql`update petshop.service_deliveries set status = 'DIBATALKAN' where id = ${row.pos_ref_id}`;
    expect(await bonus.syncBonuses()).toMatchObject({ created: 0, cancelled: 0, flagged: 0 });
  });

  it('Ditahan menjadi Menunggu sesudah jabatan penerima diubah (mulai tanggal 26)', async () => {
    const [kasir] = await sql`select id from hris.positions where name = 'Kasir'`;
    await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
      values ('position.bonus_grooming', 'POSITION', ${kasir.id}, '"YES"'::jsonb, '2026-10-26', 'ACTIVE', 'Uji: kasir ikut menerima')`;
    await bonus.syncBonuses();
    const [budi] = await sql`select status from hris.bonus_entries where employee_id = ${ids.budi}`;
    expect(budi.status).toBe('PENDING');
  });

  it('Buku Bonus: Finance hanya jumlah per jenis; catatan tidak bisa dihapus', async () => {
    const [fin] = await sql`select id from hris.positions where name = 'Finance'`;
    const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
      values (hris.next_employee_code(), 'Fina', '2026-01-01', 'BCA', '1') returning id`;
    const [branch] = await sql`select id from hris.branches limit 1`;
    await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from) values (${row.id}, 'INITIAL', ${branch.id}, ${fin.id}, 'EMPLOYEE', '2026-01-01')`;
    const book = await bonus.bonusBookScreen(await actorOf(Number(row.id)), { period: PERIOD, kind: null, status: null, employeeId: null });
    expect(book!.rows).toBeNull();
    expect(book!.totals.find((t) => t.kind === 'GROOMING')!.amount).toBeGreaterThan(0);
    await expect(sql`delete from hris.bonus_entries`).rejects.toThrow();
  });
});
