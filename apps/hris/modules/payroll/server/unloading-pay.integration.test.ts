import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L8b Bayar Bongkaran (spec L8 §3.4–3.5, §8) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l8b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const TODAY = '2026-11-07';
const REASON = 'Jumlah sak salah hitung saat bongkar';

let admin: postgres.Sql;
let sql: postgres.Sql;
let owner: Actor;
let kg: Actor;
let finance: Actor;
let helper: Actor;
let ids: Record<'owner' | 'kg' | 'helper' | 'finance', number>;
let pr: typeof import('@/modules/payroll');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let supplierId: number;
let pasirId: number;
let kgUom: number;
let sourceId: number;
let casualKey: string;
const announce = async () => {};

describe.skipIf(!ADMIN_URL)('L8b: Bayar Bongkaran', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(`${TODAY}T11:00:00+07:00`), toFake: ['Date'] });
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
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude) values ('Gudang', ${GUDANG.latitude}, ${GUDANG.longitude})`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    const [{ id: gudang }] = await sql`select id from hris.branches where name = 'Gudang'`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, '2026-01-01') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${gudang}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = { owner: await person('Elan', 'Pemilik'), kg: await person('Gani', 'Kepala Gudang'), helper: await person('Budi', 'Driver'), finance: await person('Fina', 'Finance') };
    const [kgu] = await sql`insert into petshop.units_of_measure (code, name, is_base) values ('KG', 'Kilogram', true) returning id`;
    kgUom = Number(kgu.id);
    const [pasir] = await sql`insert into petshop.products (sku, name, base_uom_id) values ('PS-1', 'Pasir Gumpal', ${kgUom}) returning id`;
    pasirId = Number(pasir.id);
    [{ id: supplierId }] = await sql`insert into petshop.suppliers (name) values ('PT Sumber Pakan') returning id`;
    supplierId = Number(supplierId);
    sourceId = Number((await sql`insert into petshop.money_places (name, kind, branch_id) values ('Kas Gudang', 'CASH', 1) returning id`)[0].id);
    const [casual] = await sql`insert into hris.casual_workers (name, phone) values ('Asep', '081299999999') returning id`;
    casualKey = `C${casual.id}`;
    pr = await import('@/modules/payroll');
    engine = await import('@/modules/requests');
    handlers = { unloading_not_received: pr.unloadingNotReceivedHandler() } as Record<string, RequestHandler>;
    const { loadActor } = await import('@/modules/access');
    owner = await loadActor(ids.owner + 1000, ids.owner);
    kg = await loadActor(ids.kg + 1000, ids.kg);
    finance = await loadActor(ids.finance + 1000, ids.finance);
    helper = await loadActor(ids.helper + 1000, ids.helper);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const photo = async (actor: Actor) => {
    const id = randomUUID();
    await sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${id}, 'image/jpeg', 10, 'x', ${actor.accountId})`;
    return id;
  };
  const input = async (kgAmount: string, participants: string[], actor: Actor = kg) => ({
    workDate: TODAY, supplierId, items: [{ productId: pasirId, uomId: kgUom, quantity: kgAmount, weightKg: '1' }], participants, photoIds: [await photo(actor)], similarConfirmedId: null,
  });
  const create = async (kgAmount: string, participants: string[]) => {
    const r = await pr.createUnloading(kg, await input(kgAmount, participants), announce);
    if (!r.ok) throw new Error(r.error);
    return r.data.id;
  };
  const pay = (actor: Actor, targets: { reportId: number; topUpId: number | null }[]) =>
    pr.payUnloading(actor, { targets, sourceId, moneyDate: TODAY, handedTo: {} }, announce);
  const remaining = async (employeeId: number) => {
    const rows = await sql`select o.amount - coalesce((select sum(u.amount) from hris.unloading_overpayment_uses u where u.overpayment_id = o.id and u.status = 'ACTIVE'), 0) as rest
      from hris.unloading_overpayments o where o.employee_id = ${employeeId} and o.status <> 'WRITTEN_OFF'`;
    return rows.reduce((s, r) => s + Number(r.rest), 0);
  };
  let reportA = 0;

  it('bayar: Finance satu langkah, pembuat/peserta ditolak, tidak bisa dua kali, peserta diberi tahu', async () => {
    reportA = await create('1000', [`E${ids.helper}`, casualKey]);
    expect((await pay(kg, [{ reportId: reportA, topUpId: null }])).ok).toBe(false);
    const paid = await pay(finance, [{ reportId: reportA, topUpId: null }]);
    expect(paid.ok && paid.data).toMatchObject({ paid: 1, total: 20_000 });
    expect((await sql`select status from hris.unloading_reports where id = ${reportA}`)[0].status).toBe('PAID');
    const [payment] = await sql`select kind, amount, money_place_id from hris.unloading_payments where report_id = ${reportA}`;
    expect(payment).toMatchObject({ kind: 'MONEY', amount: 20_000, money_place_id: sourceId });
    const [note] = await sql`select title from hris.notifications where kind = 'unloading.paid' and recipient_account_id = ${ids.helper + 1000}`;
    expect(note.title).toMatch(/Rp10\.000/);
    expect((await pay(finance, [{ reportId: reportA, topUpId: null }])).ok).toBe(false);
  });

  it('koreksi sesudah dibayar: turun → lebih bayar; naik sebagian → mengurangi lebih bayar; naik lagi → susulan; susulan dibayar', async () => {
    const dto = async (k: string) => ({ ...(await input(k, [`E${ids.helper}`, casualKey], owner)), photoIds: [], reason: REASON });
    expect((await pr.correctUnloading(kg, reportA, await dto('800'), announce)).ok).toBe(false); // sudah dibayar: hanya Pemilik/GM
    expect((await pr.correctUnloading(owner, reportA, await dto('800'), announce)).ok).toBe(true);
    expect(await remaining(ids.helper)).toBe(2000);
    expect((await pr.correctUnloading(owner, reportA, await dto('900'), announce)).ok).toBe(true);
    expect(await remaining(ids.helper)).toBe(1000);
    const preview = await pr.correctionPreview(owner, reportA, await dto('1100'));
    expect(preview.ok && preview.data.rows.find((r) => r.key === `E${ids.helper}`)).toMatchObject({ before: 9000, after: 11_000, topUp: 1000, reduced: 1000 });
    expect((await pr.correctUnloading(owner, reportA, await dto('1100'), announce)).ok).toBe(true);
    expect(await remaining(ids.helper)).toBe(0);
    const [topUp] = await sql`select id, status from hris.unloading_top_ups where report_id = ${reportA} and status = 'WAITING'`;
    const lines = await sql`select amount from hris.unloading_top_up_lines where top_up_id = ${topUp.id}`;
    expect(lines.map((l) => l.amount)).toEqual([1000, 1000]);
    const paidTopUp = await pay(finance, [{ reportId: reportA, topUpId: Number(topUp.id) }]);
    expect(paidTopUp.ok && paidTopUp.data.total).toBe(2000);
    // Batal bayar pembayaran pertama ditolak: sudah dikoreksi sesudahnya.
    const [first] = await sql`select id from hris.unloading_payments where report_id = ${reportA} and top_up_id is null`;
    expect((await pr.cancelUnloadingPayment(owner, Number(first.id), 'Salah catat tempat uang', announce)).ok).toBe(false);
  });

  it('batal sesudah dibayar → lebih bayar penuh; diperhitungkan di bongkaran berikutnya (tanpa uang); batal bayar menghidupkannya lagi', async () => {
    const b = await create('500', [`E${ids.helper}`]);
    expect((await pay(finance, [{ reportId: b, topUpId: null }])).ok).toBe(true);
    expect((await pr.cancelUnloading(kg, b, 'Laporan dobel dengan yang lain', announce)).ok).toBe(false);
    expect((await pr.cancelUnloading(owner, b, 'Laporan dobel dengan yang lain', announce)).ok).toBe(true);
    expect(await remaining(ids.helper)).toBe(10_000);
    const c = await create('250', [`E${ids.helper}`]);
    const plan = (await pr.payScreen(finance, [{ reportId: c, topUpId: null }]))!;
    expect(plan.ready[0].lines[0]).toMatchObject({ share: 5000, offset: 5000, received: 0 });
    expect((await pay(finance, [{ reportId: c, topUpId: null }])).ok).toBe(true);
    const [payC] = await sql`select id, kind, amount from hris.unloading_payments where report_id = ${c}`;
    expect(payC).toMatchObject({ kind: 'NO_MONEY', amount: 0 });
    expect(await remaining(ids.helper)).toBe(5000);
    expect((await pr.cancelUnloadingPayment(owner, Number(payC.id), 'Tertandai padahal belum diberikan', announce)).ok).toBe(true);
    expect(await remaining(ids.helper)).toBe(10_000);
    expect((await sql`select status from hris.unloading_reports where id = ${c}`)[0].status).toBe('ACTIVE');
  });

  it('lebih bayar: terima pengembalian sebagian lalu hapus sisanya', async () => {
    const [over] = await sql`select id from hris.unloading_overpayments where employee_id = ${ids.helper} and amount = 10000`;
    expect((await pr.receiveOverpaymentRefund(finance, Number(over.id), { amount: 12_000, sourceId, moneyDate: TODAY })).ok).toBe(false);
    expect((await pr.receiveOverpaymentRefund(finance, Number(over.id), { amount: 4000, sourceId, moneyDate: TODAY })).ok).toBe(true);
    expect((await pr.decideOverpayment(finance, Number(over.id), 'WRITE_OFF', 'Sudah diikhlaskan pemilik'))).toMatchObject({ ok: false });
    expect((await pr.decideOverpayment(owner, Number(over.id), 'WRITE_OFF', 'Sudah diikhlaskan pemilik'))).toMatchObject({ ok: true });
    expect(await remaining(ids.helper)).toBe(0);
    await expect(sql`update hris.unloading_overpayments set amount = 1 where id = ${over.id}`).rejects.toThrow(/tidak boleh diubah/);
  });

  it('tanyakan dulu / jawab; uang belum diterima; pengingat harian; per orang dan Pendapatan Saya', async () => {
    const [{ id: c }] = await sql`select id from hris.unloading_reports where status = 'ACTIVE' order by id desc limit 1`;
    expect((await pr.askUnloading(finance, Number(c), 'Foto surat jalan buram, betul 250 kg?')).ok).toBe(true);
    expect((await pr.unloadingListScreen(owner, { tab: 'UNPAID' }))!.rows.find((r) => r.id === Number(c))!.flags).toContain('Ditanyakan Finance');
    expect((await pr.answerUnloading(kg, Number(c), 'Betul, sudah ditimbang ulang')).ok).toBe(true);

    const [payment] = await sql`select id from hris.unloading_payments where report_id = ${reportA} and status = 'ACTIVE' and top_up_id is null`;
    const sent = await engine.submitRequest(helper, 'unloading_not_received', handlers.unloading_not_received, { fields: { paymentId: Number(payment.id), note: 'Uangnya belum sampai ke saya' }, attachmentIds: [] });
    expect(sent.ok).toBe(true);
    const mine = (await pr.myUnloadingScreen(helper))!;
    expect(mine.rows.length).toBeGreaterThanOrEqual(3);
    expect(mine.rows.find((r) => r.reportId === reportA)).toMatchObject({ share: 11_000, corrected: { from: 10_000, to: 11_000 } });

    const people = (await pr.perPersonScreen(owner, {}))!;
    const budi = people.rows.find((r) => r.name === 'Budi')!;
    expect(budi).toMatchObject({ times: 2, shares: 16_000, unpaid: 5000 });

    vi.setSystemTime(new Date('2026-11-08T07:00:00+07:00'));
    const run = await pr.runUnloadingDaily();
    expect(run.reminded).toBeGreaterThan(0);
    const [reminder] = await sql`select title from hris.notifications where kind = 'unloading.reminder' and recipient_account_id = ${ids.finance + 1000}`;
    expect(reminder.title).toMatch(/1 Laporan Bongkaran belum dibayar/);
  });
});
