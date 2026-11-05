import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT2a barang kembali + tertunda (spec LT1 §14.1) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt2a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kg' | 'driver' | 'kenek' | 'finance', number>;
let lg: typeof import('@/modules/logistics');
const pos: Record<string, number> = {};
let tripId = 0;

describe.skipIf(!ADMIN_URL)('LT2a: barang kembali dan tertunda', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(`${DAY}T07:00:00+07:00`), toFake: ['Date'] });
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
    await sql`insert into petshop.branches (code, name) values ('GDG', 'Gudang'), ('TP', 'Toko Pusat')`;
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude, kasir_branch_id) values ('Gudang', ${GUDANG.latitude}, ${GUDANG.longitude}, 1)`;
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
    ids = {
      kg: await person('Kepala Gudang Uji', 'Kepala Gudang'), driver: await person('Dedi', 'Driver'), kenek: await person('Eko', 'Kenek'),
      finance: await person('Fina', 'Finance'),
    };
    for (const [position, duty] of [['Driver', 'DRIVE'], ['Kenek', 'ASSIST']]) {
      await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji LT2a' from hris.positions where name = ${position}`;
    }
    const [route] = await sql`select id from logistics.routes where name = 'Garut'`;
    const [vehicle] = await sql`select id from logistics.vehicles where name = 'L300'`;
    const customer = async (name: string) => {
      const [row] = await sql`insert into petshop.customers (code, name, address) values (${name.slice(0, 3).toUpperCase()}, ${name}, 'Jl. Uji') returning id`;
      return Number(row.id);
    };
    const sale = async (number: string, customerId: number, remaining: number | null, status = 'UNPAID', branch = 1) => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 300000, '2026-11-05 02:00:00'::text::timestamp, ${branch}, ${customerId}, 'COMPLETED', 1, 'TRUCK') returning id`;
      if (remaining != null) {
        await sql`insert into petshop.customer_debts (customer_id, transaction_id, total_amount, paid_amount, remaining_amount, status)
          values (${customerId}, ${row.id}, 300000, ${300000 - remaining}, ${remaining}, ${status})`;
      }
      return Number(row.id);
    };
    pos.sinar = await customer('Toko Sinar');
    pos.maju = await customer('Toko Maju');
    pos.depan = await customer('Toko Depan');
    const notes = [
      await sale('TRX-A', pos.sinar, null), await sale('TRX-B', pos.maju, null), await sale('TRX-P', pos.maju, null, 'UNPAID', 2),
      await sale('TRX-C', pos.depan, null),
    ];

    lg = await import('@/modules/logistics');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, {
      vehicleId: Number(vehicle.id), routeId: Number(route.id), shoppingRouteIds: [], driverId: ids.driver, assistantIds: [ids.kenek],
      noteKeys: notes.map((id) => `S${id}`),
    });
    tripId = made.ok ? made.data.id : 0;
    await lg.markReady(kg, tripId);
    vi.setSystemTime(new Date(`${DAY}T08:00:00+07:00`));
    await lg.departTrip(await actorOf(ids.driver), tripId, jpeg(), GUDANG);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const visitOf = async (destination: string) => (await lg.tripDetailScreen(await actorOf(ids.kg), tripId))!.delivery.visits
    .filter((v) => v.destination === destination).at(-1)!;
  const at = (clock: string, day = DAY) => vi.setSystemTime(new Date(`${day}T${clock}:00+07:00`));
  const RETURN_ITEMS = [{ name: 'Royal Canin 2 kg', quantity: '2', unit: 'pcs' }, { name: 'Pasir', quantity: '1,5', unit: 'sak' }];

  it('rincian retur wajib nama, jumlah, satuan; pemilik = cabang asal surat jalan', async () => {
    expect(lg.cleanReturnItems([{ name: 'Pasir', quantity: '0', unit: 'sak' }])).toMatchObject({ ok: false });
    expect(lg.cleanReturnItems([{ name: 'Pasir', quantity: '1.234', unit: 'sak' }])).toMatchObject({ ok: false });
    expect(lg.cleanReturnItems(RETURN_ITEMS)).toEqual({ ok: true, items: [
      { name: 'Royal Canin 2 kg', quantity: '2', unit: 'pcs' }, { name: 'Pasir', quantity: '1.50', unit: 'sak' },
    ] });
    const driver = await actorOf(ids.driver);
    const pickup = (await lg.tripDetailScreen(await actorOf(ids.kg), tripId))!.delivery.pickups.find((p) => p.status === 'OPEN')!;
    expect((await lg.finishPickup(await actorOf(ids.kenek), tripId, pickup.id, jpeg())).ok).toBe(true);
    // Sinar: Kirim Besok, Coba lagi, lalu Terkirim → surat jalannya tidak ikut barang kembali.
    expect((await lg.processVisit(driver, tripId, (await visitOf('Toko Sinar')).id, { outcome: 'TOMORROW', reasonCode: 'CLOSED' }, jpeg())).ok).toBe(true);
    expect((await lg.retryVisit(driver, tripId, (await visitOf('Toko Sinar')).id)).ok).toBe(true);
    expect((await lg.processVisit(driver, tripId, (await visitOf('Toko Sinar')).id, { outcome: 'DELIVERED', point: GUDANG }, jpeg())).ok).toBe(true);
    const sinar = await visitOf('Toko Sinar');
    expect(await lg.addVisitReport(driver, tripId, sinar.id, { kind: 'RETURN', note: 'kedaluwarsa' }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect((await lg.addVisitReport(driver, tripId, sinar.id, { kind: 'RETURN', note: 'kedaluwarsa', items: RETURN_ITEMS }, jpeg())).ok).toBe(true);
    expect((await visitOf('Toko Sinar')).reports[0].items).toEqual([
      { name: 'Royal Canin 2 kg', quantity: '2', unit: 'pcs' }, { name: 'Pasir', quantity: '1,5', unit: 'sak' },
    ]);
    const [report] = await sql`select owner_branch_id from logistics.visit_reports`;
    expect(Number(report.owner_branch_id)).toBe(1);
    // Maju: surat jalan dari Gudang dan Toko Pusat → Kirim Besok. Depan: Gagal.
    expect((await visitOf('Toko Maju')).origins.map((o) => o.name).sort()).toEqual(['Gudang', 'Toko Pusat']);
    expect((await lg.processVisit(driver, tripId, (await visitOf('Toko Maju')).id, { outcome: 'TOMORROW', reasonCode: 'NOBODY' }, jpeg())).ok).toBe(true);
    expect((await lg.processVisit(driver, tripId, (await visitOf('Toko Depan')).id, { outcome: 'FAILED', reasonCode: 'REFUSED' }, jpeg())).ok).toBe(true);
    // Belum Sampai Garasi → belum ada barang kembali.
    expect((await lg.returnedGoodsScreen(await actorOf(ids.kg)))!.warehouse).toHaveLength(0);
    at('15:00');
    expect((await lg.headHome(driver, tripId, jpeg(), null)).ok).toBe(true);
    expect((await lg.arriveTrip(driver, tripId, GUDANG, jpeg())).ok).toBe(true);
  });

  it('barang kembali: diterima di Gudang (Sesuai / Tidak sesuai), milik Toko Pusat lalu di cabangnya', async () => {
    const kg = await actorOf(ids.kg);
    const screen = (await lg.returnedGoodsScreen(kg))!;
    expect(screen.warehouse.map((r) => r.what).sort()).toEqual([
      'Gagal: nota TRX-C', 'Kirim Besok: nota TRX-B', 'Kirim Besok: nota TRX-P', 'Retur dibawa pulang',
    ]);
    expect(screen.warehouse.find((r) => r.what.endsWith('TRX-P'))).toMatchObject({ owner: 'Toko Pusat', ownerIsHome: false });
    expect(await lg.returnedGoodsWaiting(kg)).toBe(4);
    expect(await lg.returnedGoodsScreen(await actorOf(ids.finance))).toBeNull();
    const ret = screen.warehouse.find((r) => r.kind === 'RETURN')!;
    const pusat = screen.warehouse.find((r) => r.what.endsWith('TRX-P'))!;
    expect(await lg.receiveGoods(await actorOf(ids.driver), { kind: 'RETURN', sourceId: ret.sourceId, result: 'MATCH' }, jpeg())).toMatchObject({ ok: false, status: 403 });
    expect(await lg.receiveGoods(kg, { kind: 'RETURN', sourceId: ret.sourceId, result: 'MISMATCH' }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect(await lg.receiveGoods(kg, { kind: 'RETURN', sourceId: ret.sourceId, result: 'MATCH' }, null)).toMatchObject({ ok: false, status: 400 });
    expect((await lg.receiveGoods(kg, { kind: 'RETURN', sourceId: ret.sourceId, result: 'MISMATCH', note: 'pasir hanya 1 sak' }, jpeg())).ok).toBe(true);
    expect(await lg.receiveGoods(kg, { kind: 'RETURN', sourceId: ret.sourceId, result: 'MATCH' }, jpeg())).toMatchObject({ ok: false, status: 409 });
    // Pemberitahuan ke Kepala Gudang / Pemilik / GM, kecuali penerimanya sendiri (di DB uji hanya Kepala Gudang).
    expect(await sql`select 1 from hris.notifications where kind = 'logistics.goods_mismatch' and recipient_account_id = ${ids.kg + 1000}`).toHaveLength(0);
    expect((await lg.receiveGoods(kg, { kind: 'NOTE', sourceId: pusat.sourceId, result: 'MATCH' }, jpeg())).ok).toBe(true);
    const after = (await lg.returnedGoodsScreen(kg))!;
    expect(after.owner.map((r) => r.what)).toEqual(['Kirim Besok: nota TRX-P']);
    expect(after.done.find((r) => r.kind === 'RETURN')).toMatchObject({ mismatch: true });
    expect((await lg.receiveGoods(kg, { kind: 'NOTE', sourceId: pusat.sourceId, result: 'MATCH' }, jpeg())).ok).toBe(true);
    expect((await lg.returnedGoodsScreen(kg))!.owner).toHaveLength(0);
    const photo = after.done.find((r) => r.kind === 'RETURN')!.receipts[0].photoUrl.split('file=')[1];
    expect(await lg.openTripPhoto(kg, tripId, photo)).toBe(photo);
    expect(await lg.openTripPhoto(await actorOf(ids.finance), tripId, photo)).toBeNull();
    await expect(sql`delete from logistics.goods_receipts`).rejects.toThrow();
  });

  it('tertunda: Kirim Besok dan Kirim ulang tercatat, Coba lagi tidak; merah lewat batas; tutup dengan keterangan', async () => {
    const kg = await actorOf(ids.kg);
    const depan = (await sql`select id from logistics.delivery_notes where number = 'TRX-C'`)[0];
    expect((await lg.decideNote(kg, Number(depan.id), 'RESEND', 'Toko minta dikirim lagi')).ok).toBe(true);
    let screen = (await lg.pendingNotesScreen(kg))!;
    expect(screen.rows.map((r) => r.number).sort()).toEqual(['TRX-B', 'TRX-C', 'TRX-P']);
    expect(screen.rows.find((r) => r.number === 'TRX-B')).toMatchObject({ times: 1, firstOn: DAY, red: false, status: 'WAITING' });
    expect(await lg.pendingNoteCounts(kg)).toEqual({ total: 3, red: 0 });
    at('09:00', '2026-11-10');
    expect(await lg.pendingNoteCounts(kg)).toEqual({ total: 3, red: 3 });
    const b = screen.rows.find((r) => r.number === 'TRX-B')!;
    expect(await lg.closePending(await actorOf(ids.driver), b.noteId, 'Sudah ditelepon')).toMatchObject({ ok: false, status: 403 });
    expect(await lg.closePending(kg, b.noteId, 'ok')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.closePending(kg, b.noteId, 'Toko minta dikirim Senin')).ok).toBe(true);
    expect(await lg.closePending(kg, b.noteId, 'Toko minta dikirim Senin')).toMatchObject({ ok: false, status: 409 });
    screen = (await lg.pendingNotesScreen(kg))!;
    expect(screen.rows.map((r) => r.number).sort()).toEqual(['TRX-C', 'TRX-P']);
    expect(screen.closed[0]).toMatchObject({ number: 'TRX-B', note: 'Toko minta dikirim Senin' });
    expect((await sql`select status from logistics.delivery_notes where number = 'TRX-B'`)[0].status).toBe('WAITING');
  });
});
