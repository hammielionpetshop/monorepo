import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// F2-1b migrasi hris 0056 (spec F2-1 §6 no.5): Sumber Uang lama dipetakan ke Tempat Uang Back Office.
// Jalan bila ROLES_TEST_ADMIN_URL diisi.
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_f21b_mig_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const TARGET = '0056_f2_1b_money_places.sql';

let admin: postgres.Sql;
let sql: postgres.Sql;

describe.skipIf(!ADMIN_URL)('F2-1b: pemetaan Sumber Uang ke Tempat Uang', () => {
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
    await sql.unsafe(readFileSync(new URL('hris-db/test-stubs/petshop-pos.sql', root), 'utf8'));
    const { drizzle } = requireAuth('drizzle-orm/postgres-js');
    const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator');
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(new URL('auth/src/migrations/', root)), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth',
    });
    await migrationClient.end();
    const folder = new URL('hris-db/src/migrations/', root);
    const files = readdirSync(folder).filter((name) => name.endsWith('.sql')).sort();
    for (const file of files.filter((f) => f < TARGET)) await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();

    // Keadaan staging sebelum 0056: Brankas & Rekening Kantor (isi awal 0024) + satu sumber tambahan, sudah dipakai bayar.
    await sql`insert into petshop.branches (code, name) values ('TA', 'Toko A'), ('GDG', 'Gudang')`;
    await sql`insert into petshop.money_places (name, kind, branch_id, held_by) values ('Laci Kasir Toko A', 'DRAWER', 1, 'STORE'), ('brankas', 'CASH', 1, 'FINANCE')`;
    await sql`insert into hris.payment_sources (name, method, sort_order) values ('Kas Kecil Kantor', 'CASH', 3)`;
    const sources = await sql`select id, name from hris.payment_sources`;
    for (const s of sources) {
      await sql`insert into hris.pay_batches (paid_by_account_id, source_id, money_date) values (1, ${s.id}, '2026-11-01')`;
    }
    await sql.unsafe(readFileSync(new URL(TARGET, folder), 'utf8')).simple();
    for (const file of files.filter((f) => f > TARGET)) await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
  }, 180_000);

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  it('nama sama dipakai ulang (bukan Laci); yang belum ada dibuatkan di Gudang, dipegang Finance', async () => {
    const places = await sql`select name, kind, branch_id, bank_name, account_number, held_by from petshop.money_places order by id`;
    expect(places).toEqual([
      { name: 'Laci Kasir Toko A', kind: 'DRAWER', branch_id: 1, bank_name: null, account_number: null, held_by: 'STORE' },
      { name: 'brankas', kind: 'CASH', branch_id: 1, bank_name: null, account_number: null, held_by: 'FINANCE' },
      { name: 'Rekening Kantor', kind: 'BANK', branch_id: 2, bank_name: 'Perlu dilengkapi', account_number: '-', held_by: 'FINANCE' },
      { name: 'Kas Kecil Kantor', kind: 'CASH', branch_id: 2, bank_name: null, account_number: null, held_by: 'FINANCE' },
    ]);
  });

  it('semua pembayaran lama mendapat money_place_id sesuai namanya; view HRIS membaca Tempat Uang', async () => {
    const rows = await sql`select s.name as source, m.name as place from hris.pay_batches b
      join hris.payment_sources s on s.id = b.source_id join hris.pos_money_places m on m.id = b.money_place_id order by b.id`;
    expect(rows.map((r) => [r.source, r.place])).toEqual([
      ['Brankas', 'brankas'], ['Rekening Kantor', 'Rekening Kantor'], ['Kas Kecil Kantor', 'Kas Kecil Kantor'],
    ]);
    await expect(sql`update hris.pay_batches set money_place_id = 1`).rejects.toThrow();
    await expect(sql`insert into hris.pay_batches (paid_by_account_id, money_date) values (1, '2026-11-02')`).rejects.toThrow(/money_place_id/);
  });
});
