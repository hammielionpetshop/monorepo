import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L7a Tarif Ritase + Buku Upah ritase (spec L7 §8) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l7a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-02';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const FAR = { latitude: -7.36, longitude: 108.1 };
const REASON = 'Alasan uji yang cukup panjang';
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'kg' | 'driver' | 'kenek' | 'kenek2' | 'kasir', number>;
let lg: typeof import('@/modules/logistics');
let pr: typeof import('@/modules/payroll');
let route: Record<string, number>;
let vehicle: Record<string, number>;

const at = (clock: string) => vi.setSystemTime(new Date(`${DAY}T${clock}:00+07:00`));

describe.skipIf(!ADMIN_URL)('L7a: tarif ritase dan upah ritase', () => {
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
    // Urutan pnpm db:migrate: logistics lebih dulu, lalu hris (0031 mengisi titik garasi = Gudang).
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
    ids = {
      owner: await person('Elan', 'Pemilik'), kg: await person('Kepala Gudang Uji', 'Kepala Gudang'), driver: await person('Dedi', 'Driver'),
      kenek: await person('Eko', 'Kenek'), kenek2: await person('Fajar', 'Kenek'), kasir: await person('Kasir Uji', 'Kasir'),
    };
    // Driver menyetir, Kenek jadi kenek: izin otomatis jabatan (KAR-64).
    for (const [position, duty] of [['Driver', 'DRIVE'], ['Kenek', 'ASSIST'], ['Kasir', 'ASSIST']]) {
      await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji L6' from hris.positions where name = ${position}`;
    }
    route = Object.fromEntries((await sql`select id, name from logistics.routes`).map((r) => [r.name, Number(r.id)]));
    vehicle = Object.fromEntries((await sql`select id, name from logistics.vehicles`).map((r) => [r.name, Number(r.id)]));
    lg = await import('@/modules/logistics');
    pr = await import('@/modules/payroll');
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

  const live = (wageIds?: number[]) => sql`
    select v.wage_id, v.employee_id, v.kind, v.role, v.amount, v.status, v.zero_reason, v.pay_basis, v.week_start::text
    from hris.trip_wage_values v where v.status <> 'CANCELLED' ${wageIds ? sql`and v.wage_id in ${sql(wageIds)}` : sql``}
    order by v.employee_id, v.kind`;

  it('isi awal: 25 tarif dari owner berlaku 30 Okt 2026; L300 dan Grand Max ke Cirebon tanpa tarif', async () => {
    const rows = await sql`select count(*)::int as n, min(effective_from)::text as f from logistics.trip_rates where status = 'ACTIVE'`;
    expect(rows[0]).toMatchObject({ n: 25, f: '2026-10-30' });
    const cirebon = await sql`select vehicle_id from logistics.trip_rates where route_id = ${route['Cirebon']}`;
    expect(cirebon.map((r) => Number(r.vehicle_id))).toEqual([vehicle['Engkel Box']]);
    const agus = await lg.rateOn(vehicle['L300'], route['H. Agus'], DAY);
    expect(agus).toMatchObject({ driverWithAssistant: 15_000, assistant: 0, driverAlone: 15_000 });
  });

  it('Berangkat ditolak bila pasangan belum bertarif (LOG-21)', async () => {
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, { vehicleId: vehicle['L300'], routeId: route['Cirebon'], shoppingRouteIds: [], driverId: ids.driver, assistantIds: [] });
    expect(made.ok).toBe(true);
    const tripId = made.ok ? made.data.id : 0;
    at('07:30');
    // LT1b-2a: syarat bertarif diperiksa saat Siap Kirim (dan lagi saat Berangkat).
    expect(await lg.markReady(kg, tripId)).toMatchObject({ ok: false, error: expect.stringContaining('L300 ke Cirebon belum punya tarif') });
    expect((await lg.cancelTrip(kg, tripId, REASON)).ok).toBe(true);
  });

  it('trip selesai → upah sekali per awak: tarif per peran, kenek belanja Rp0, staf bulanan di hari kerja Rp0', async () => {
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, {
      vehicleId: vehicle['L300'], routeId: route['Garut'], shoppingRouteIds: [route['Aina PS']], driverId: ids.driver, assistantIds: [ids.kenek, ids.kasir],
    });
    const tripId = made.ok ? made.data.id : 0;
    expect((await lg.markReady(kg, tripId)).ok).toBe(true);
    at('08:00');
    expect((await lg.departTrip(await actorOf(ids.driver), tripId, jpeg(), null)).ok).toBe(true);
    const [shop] = await sql`select id from logistics.trip_shopping where trip_id = ${tripId}`;
    expect((await lg.finishShopping(await actorOf(ids.driver), tripId, Number(shop.id), jpeg())).ok).toBe(true);
    at('15:00');
    expect((await lg.headHome(await actorOf(ids.driver), tripId, jpeg(), null)).ok).toBe(true);
    expect((await lg.arriveTrip(await actorOf(ids.driver), tripId, GUDANG, jpeg())).ok).toBe(true);
    expect(await pr.syncTripWages({ tripId })).toEqual({ written: 6, cancelled: 0 });
    const rows = await live();
    const pick = (employeeId: number, kind: string) => rows.find((r) => Number(r.employee_id) === employeeId && r.kind === kind);
    expect(pick(ids.driver, 'RITASE')).toMatchObject({ amount: 110_000, status: 'ACTIVE', pay_basis: 'WEEKLY', week_start: '2026-10-30' });
    expect(pick(ids.driver, 'SHOPPING')).toMatchObject({ amount: 15_000 });
    expect(pick(ids.kenek, 'RITASE')).toMatchObject({ amount: 40_000 });
    expect(pick(ids.kenek, 'SHOPPING')).toMatchObject({ amount: 0, zero_reason: 'NO_ASSISTANT_PAY' });
    expect(pick(ids.kasir, 'RITASE')).toMatchObject({ amount: 0, pay_basis: 'MONTHLY', zero_reason: expect.stringMatching(/WORKDAY|NOT_DAY_OFF/) });
    // Dijalankan lagi tanpa perubahan: tidak menulis apa pun.
    expect(await pr.syncTripWages({ tripId })).toEqual({ written: 0, cancelled: 0 });
  });

  it('angka upah tidak bisa diubah atau dihapus', async () => {
    const [v] = await sql`select id from hris.trip_wage_values limit 1`;
    await expect(sql`update hris.trip_wage_values set amount = 1 where id = ${v.id}`).rejects.toThrow(/tidak boleh diubah/);
    await expect(sql`delete from hris.trip_wage_values where id = ${v.id}`).rejects.toThrow();
  });

  it('Belum bertarif → tarif pasangan baru (berlaku hari ini) → dinilai ulang', async () => {
    const [{ id }] = await sql`insert into logistics.routes (name, kind) values ('Banjar Uji', 'DELIVERY') returning id`;
    const newRoute = Number(id);
    const owner = await actorOf(ids.owner);
    const manual = { employeeId: ids.driver, tripDate: DAY, vehicleId: vehicle['Engkel Box'], routeId: newRoute, role: 'DRIVER' as const, withAssistant: false, reason: REASON, confirmTwice: false };
    expect(await lg.addManualWage(owner, manual)).toMatchObject({ ok: false, error: expect.stringContaining('Engkel Box ke Banjar Uji belum punya tarif') });
    // Pagar terakhir: baris ritase tanpa tarif tetap dinilai, Rp0 Belum bertarif.
    const [w] = await sql`insert into logistics.trip_wages (employee_id, role, kind, trip_date, vehicle_id, route_id, with_assistant, origin, manual_reason)
      values (${ids.driver}, 'DRIVER', 'RITASE', ${DAY}, ${vehicle['Engkel Box']}, ${newRoute}, false, 'MANUAL', ${REASON}) returning id`;
    await pr.syncTripWages({ ids: [Number(w.id)] });
    expect((await live([Number(w.id)]))[0]).toMatchObject({ status: 'UNRATED', amount: 0 });
    const input = { vehicleId: vehicle['Engkel Box'], routeId: newRoute, effectiveFrom: DAY, driverWithAssistant: 100_000, assistant: 40_000, driverAlone: 140_000 };
    expect(await lg.createRate(await actorOf(ids.kg), input)).toMatchObject({ ok: false, status: 403 });
    expect((await lg.createRate(owner, input)).ok).toBe(true);
    await pr.syncTripWages({ pairs: [{ vehicleId: vehicle['Engkel Box'], routeId: newRoute }], from: DAY });
    expect((await live([Number(w.id)]))[0]).toMatchObject({ status: 'ACTIVE', amount: 140_000 });
    const [old] = await sql`select cancel_reason, replaced_by_id from hris.trip_wage_values where wage_id = ${w.id} and status = 'CANCELLED'`;
    expect(old.cancel_reason).toContain('tarif pasangan ini sudah diisi');
    expect(old.replaced_by_id).not.toBeNull();
  });

  it('tarif baru: tidak mundur, turun paling cepat 7 hari; terjadwal bisa dibatalkan, yang berlaku tidak', async () => {
    const owner = await actorOf(ids.owner);
    const pair = { vehicleId: vehicle['Grand Max Box'], routeId: route['Garut'] };
    expect(await lg.createRate(owner, { ...pair, effectiveFrom: DAY, driverWithAssistant: 95_000, assistant: 30_000, driverAlone: 125_000 }))
      .toMatchObject({ ok: false, error: expect.stringContaining('paling cepat 3 November 2026') });
    expect(await lg.createRate(owner, { ...pair, effectiveFrom: '2026-11-03', driverWithAssistant: 85_000, assistant: 30_000, driverAlone: 115_000 }))
      .toMatchObject({ ok: false, error: expect.stringContaining('9 November 2026') });
    const up = await lg.createRate(owner, { ...pair, effectiveFrom: '2026-11-06', driverWithAssistant: 95_000, assistant: 30_000, driverAlone: 125_000 });
    expect(up.ok).toBe(true);
    expect(await lg.rateOn(pair.vehicleId, pair.routeId, '2026-11-05')).toMatchObject({ driverWithAssistant: 90_000 });
    expect(await lg.rateOn(pair.vehicleId, pair.routeId, '2026-11-06')).toMatchObject({ driverWithAssistant: 95_000 });
    const [inForce] = await sql`select id from logistics.trip_rates where vehicle_id = ${pair.vehicleId} and route_id = ${pair.routeId} and effective_from = '2026-10-30'`;
    expect(await lg.cancelRate(owner, Number(inForce.id), REASON)).toMatchObject({ ok: false, status: 409 });
    expect((await lg.cancelRate(owner, up.ok ? up.data.id : 0, REASON)).ok).toBe(true);
    expect(await lg.rateOn(pair.vehicleId, pair.routeId, '2026-11-06')).toMatchObject({ driverWithAssistant: 90_000 });
  });

  it('betulkan salah ketik: akibat per orang, baris lama Dibetulkan, upah dinilai ulang + orangnya diberi tahu', async () => {
    const owner = await actorOf(ids.owner);
    const [rate] = await sql`select id from logistics.trip_rates where vehicle_id = ${vehicle['L300']} and route_id = ${route['Garut']} and status = 'ACTIVE'`;
    const fixed = { driverWithAssistant: 120_000, assistant: 40_000, driverAlone: 150_000 };
    const impact = await pr.rateFixImpact(owner, Number(rate.id), fixed);
    expect(impact?.blocked).toBeNull();
    expect(impact?.perPerson).toContainEqual({ name: 'Dedi', diff: 10_000 });
    expect((await lg.fixRate(owner, Number(rate.id), fixed, REASON)).ok).toBe(true);
    await pr.syncTripWages({ pairs: [{ vehicleId: vehicle['L300'], routeId: route['Garut'] }], from: '2026-10-30' });
    expect((await live()).some((r) => Number(r.employee_id) === ids.driver && r.kind === 'RITASE' && r.amount === 120_000)).toBe(true);
    expect((await sql`select status from logistics.trip_rates where id = ${rate.id}`)[0].status).toBe('FIXED');
    const [note] = await sql`select title, body from hris.notifications where kind = 'wage.trip_revalued' and recipient_account_id = ${ids.driver + 1000} and title like 'Ritase Garut%'`;
    expect(note.title).toContain('Rp110.000 → Rp120.000');
    expect(note.body).toContain('tarif dibetulkan');
  });

  it('batal ritase → upahnya ikut batal, tidak ada upah berlaku', async () => {
    const owner = await actorOf(ids.owner);
    const [w] = await sql`select id from logistics.trip_wages where employee_id = ${ids.kenek} and kind = 'RITASE' and cancelled_at is null`;
    expect((await lg.cancelWage(owner, Number(w.id), REASON)).ok).toBe(true);
    expect(await pr.syncTripWages({ ids: [Number(w.id)] })).toEqual({ written: 0, cancelled: 1 });
    expect(await live([Number(w.id)])).toEqual([]);
  });
});
