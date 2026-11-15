import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/modules/access';

// F3-2 Pengumuman Darurat (spec F3-2 §7) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_f3_2_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));

let admin: postgres.Sql;
let sql: postgres.Sql;
let svc: typeof import('@/modules/announcements');
let actorOf: (employeeId: number) => Promise<Actor>;
let branchA: number;
let branchB: number;
let kasirPos: number;
let ids: Record<'owner' | 'hr' | 'adminHr' | 'kasirA' | 'kasirB' | 'kepalaA' | 'mover', number>;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

describe.skipIf(!ADMIN_URL)('F3-2: pengumuman darurat', () => {
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
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude) values ('Singaparna', -7.35, 108.1)`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    branchA = Number((await sql`select id from hris.branches where name = 'Singaparna'`)[0].id);
    branchB = Number((await sql`insert into hris.branches (name, latitude, longitude) values ('Tasik', -7.3, 108.2) returning id`)[0].id);
    const position = async (name: string) => Number((await sql`select id from hris.positions where name = ${name}`)[0].id);
    kasirPos = await position('Kasir');
    const person = async (name: string, positionName: string, branch: number) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branch}, ${await position(positionName)}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik', branchA),
      hr: await person('Hana', 'HR', branchA),
      adminHr: await person('Adi', 'Admin HR', branchA),
      kasirA: await person('Kiki', 'Kasir', branchA),
      kasirB: await person('Bela', 'Kasir', branchB),
      kepalaA: await person('Kepa', 'Kepala Toko', branchA),
      mover: await person('Pindah', 'Kasir', branchB),
    };
    svc = await import('@/modules/announcements');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const send = async (by: number, target: Parameters<typeof svc.sendEmergency>[1]['target'], title = 'Toko tutup') =>
    svc.sendEmergency(await actorOf(by), { title, message: 'Banjir, toko tutup hari ini.', target, showsUntilDate: today() });
  const pendingIds = async (employeeId: number) => (await svc.pendingEmergencies(await actorOf(employeeId))).map((item) => item.id);

  it('hak: HR kirim; Admin HR hanya lihat; karyawan biasa ditolak', async () => {
    expect(await send(ids.kasirA, { all: true })).toMatchObject({ ok: false, status: 403 });
    expect(await send(ids.adminHr, { all: true })).toMatchObject({ ok: false, status: 403 });
    expect((await svc.listEmergencies(await actorOf(ids.adminHr))).ok).toBe(true);
    expect((await svc.listEmergencies(await actorOf(ids.kasirA))).ok).toBe(false);
  });

  it('Kasir di Singaparna: hanya irisan cabang dan jabatan yang menerima; terbaru dulu', async () => {
    const first = await send(ids.hr, { all: false, branchIds: [branchA], positionIds: [kasirPos] }, 'Pertama');
    if (!first.ok) throw new Error(first.error);
    expect(first.value.recipients).toBe(1);
    const second = await send(ids.owner, { all: false, branchIds: [branchA], positionIds: [] }, 'Kedua');
    if (!second.ok) throw new Error(second.error);
    expect(await pendingIds(ids.kasirA)).toEqual([second.value.id, first.value.id]);
    expect(await pendingIds(ids.kepalaA)).toEqual([second.value.id]);
    expect(await pendingIds(ids.kasirB)).toEqual([]);
    // Pengirim yang termasuk sasaran ikut menerima.
    expect(await pendingIds(ids.hr)).toEqual([second.value.id]);
  });

  it('sudah baca: sekali per orang, diulang tetap satu baris, tidak kembali ke antrean', async () => {
    const [item] = await svc.pendingEmergencies(await actorOf(ids.kepalaA));
    expect((await svc.markEmergencyRead(await actorOf(ids.kepalaA), item.id)).ok).toBe(true);
    expect((await svc.markEmergencyRead(await actorOf(ids.kepalaA), item.id)).ok).toBe(true);
    expect(Number((await sql`select count(*) from hris.announcement_reads where announcement_id = ${item.id}`)[0].count)).toBe(1);
    expect(await pendingIds(ids.kepalaA)).toEqual([]);
    // Bukan sasaran tidak bisa menandai.
    expect(await svc.markEmergencyRead(await actorOf(ids.kasirB), item.id)).toMatchObject({ ok: false });
  });

  it('orang yang pindah ke cabang sasaran sesudah terkirim ikut menerima', async () => {
    const sent = await send(ids.hr, { all: false, branchIds: [branchA], positionIds: [] }, 'Untuk Singaparna');
    if (!sent.ok) throw new Error(sent.error);
    expect(await pendingIds(ids.mover)).toEqual([]);
    await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
      values (${ids.mover}, 'BRANCH', ${branchA}, ${kasirPos}, 'EMPLOYEE', ${today()})`;
    expect(await pendingIds(ids.mover)).toContain(sent.value.id);
    const readers = await svc.emergencyReaders(await actorOf(ids.adminHr), sent.value.id);
    if (!readers.ok) throw new Error(readers.error);
    expect(readers.value.readers.map((r) => r.employeeId)).toContain(ids.mover);
    expect(readers.value.canEnd).toBe(false);
  });

  it('Akhiri sekarang: yang belum baca tidak lagi menerima; tidak bisa diakhiri dua kali', async () => {
    const sent = await send(ids.hr, { all: true }, 'Salah kirim');
    if (!sent.ok) throw new Error(sent.error);
    expect(await pendingIds(ids.kasirB)).toContain(sent.value.id);
    expect(await svc.endEmergency(await actorOf(ids.adminHr), sent.value.id, 'Salah kirim')).toMatchObject({ ok: false, status: 403 });
    expect(await svc.endEmergency(await actorOf(ids.hr), sent.value.id, '')).toMatchObject({ ok: false, status: 400 });
    expect((await svc.endEmergency(await actorOf(ids.hr), sent.value.id, 'Salah cabang')).ok).toBe(true);
    expect(await pendingIds(ids.kasirB)).not.toContain(sent.value.id);
    expect(await svc.endEmergency(await actorOf(ids.hr), sent.value.id, 'Lagi')).toMatchObject({ ok: false, status: 409 });
    const list = await svc.listEmergencies(await actorOf(ids.hr));
    if (!list.ok) throw new Error(list.error);
    expect(list.value.rows.find((row) => row.id === sent.value.id)?.status).toBe('ENDED');
  });

  it('akses terbatas tidak mendapat darurat', async () => {
    const actor = await actorOf(ids.kasirB);
    expect(await svc.pendingEmergencies({ ...actor, limited: { since: '2026-11-01' } })).toEqual([]);
  });

  it('DB menolak ubah isi dan hapus pengumuman, sasaran, dan catatan baca', async () => {
    const [{ id }] = await sql`select id from hris.announcements order by id limit 1`;
    await expect(sql`update hris.announcements set title = 'Ubah' where id = ${id}`).rejects.toThrow(/tidak boleh diubah/);
    await expect(sql`delete from hris.announcements where id = ${id}`).rejects.toThrow(/tidak boleh dihapus/);
    await expect(sql`delete from hris.announcement_targets`).rejects.toThrow(/hanya boleh ditambah/);
    await expect(sql`update hris.announcement_reads set read_at = now()`).rejects.toThrow(/hanya boleh ditambah/);
  });
});
