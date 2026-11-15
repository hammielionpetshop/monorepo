import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// F3-3a Papan Perubahan Aturan (spec F3-3 §7) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_f3_3_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));

let admin: postgres.Sql;
let sql: postgres.Sql;
let svc: typeof import('@/modules/announcements');
let requestsSvc: typeof import('@/modules/requests');
let actorOf: (employeeId: number) => Promise<Actor>;
let branchA: number;
let branchB: number;
let kasirPos: number;
let ids: Record<'owner' | 'hr' | 'adminHr' | 'kasirA' | 'kasirB' | 'kepalaA' | 'mover', number>;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

describe.skipIf(!ADMIN_URL)('F3-3a: papan perubahan aturan', () => {
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
    process.env.AUTH_COOKIE_ENV = 'staging';
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
    requestsSvc = await import('@/modules/requests');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const addDays = (date: string, days: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const draftInput = (over: Partial<import('@/modules/announcements').DraftInput> = {}): import('@/modules/announcements').DraftInput => ({
    title: 'Jam masuk Singaparna', beforeText: 'Masuk 08.00', afterText: 'Masuk 07.30', askWhom: 'HR',
    changeKind: 'UNFAVORABLE', affectsMoney: false, target: { all: false, branchIds: [branchA], positionIds: [] },
    publishesAt: null, effectiveOn: addDays(today(), 7), supersedesAnnouncementId: null, ...over,
  });
  const write = async (by: number, over: Partial<import('@/modules/announcements').DraftInput> = {}) => {
    const created = await svc.createDraft(await actorOf(by), draftInput(over));
    if (!created.ok) throw new Error(created.error);
    return created.value.id;
  };
  const publish = async (by: number, over: Partial<import('@/modules/announcements').DraftInput> = {}) => {
    const result = await svc.publishDraft(await actorOf(by), await write(by, over), 'now');
    if (!result.ok) throw new Error(result.error);
    return result.value.announcementId;
  };
  const unreadIds = async (employeeId: number) => (await svc.unreadAnnouncements(await actorOf(employeeId))).filter((i) => i.kind === 'RULE').map((i) => i.id);
  const handlers = () => ({ rule_announcement: svc.ruleAnnouncementHandler() }) as unknown as Parameters<typeof requestsSvc.decideRequest>[2];

  it('hak: Admin HR hanya konsep; karyawan biasa tidak bisa menulis', async () => {
    const draftId = await write(ids.adminHr);
    expect(await svc.publishDraft(await actorOf(ids.adminHr), draftId, 'now')).toMatchObject({ ok: false, status: 403 });
    expect(await svc.createDraft(await actorOf(ids.kasirA), draftInput())).toMatchObject({ ok: false, status: 403 });
    expect((await svc.listRuleOffice(await actorOf(ids.kasirA))).ok).toBe(false);
    // HR bisa menerbitkan konsep buatan Admin HR.
    expect((await svc.publishDraft(await actorOf(ids.hr), draftId, 'now')).ok).toBe(true);
  });

  it('jarak kurang ditolak; konsep yang sudah terbit tidak bisa diubah', async () => {
    const draftId = await write(ids.hr, { effectiveOn: addDays(today(), 3) });
    expect(await svc.publishDraft(await actorOf(ids.hr), draftId, 'now')).toMatchObject({ ok: false, status: 400 });
    expect((await svc.updateDraft(await actorOf(ids.hr), draftId, draftInput())).ok).toBe(true);
    expect((await svc.publishDraft(await actorOf(ids.hr), draftId, 'now')).ok).toBe(true);
    expect(await svc.updateDraft(await actorOf(ids.hr), draftId, draftInput())).toMatchObject({ ok: false, status: 409 });
  });

  it('sasaran hanya melihat yang mengenai dirinya; sudah baca sekali', async () => {
    const id = await publish(ids.hr, { title: 'Khusus Singaparna' });
    expect(await unreadIds(ids.kasirA)).toContain(id);
    expect(await unreadIds(ids.kasirB)).not.toContain(id);
    expect(await svc.ruleDetail(await actorOf(ids.kasirB), id)).toMatchObject({ ok: false, status: 404 });
    expect(await svc.markAnnouncementRead(await actorOf(ids.kasirB), id)).toMatchObject({ ok: false });
    expect((await svc.markAnnouncementRead(await actorOf(ids.kasirA), id)).ok).toBe(true);
    expect((await svc.markAnnouncementRead(await actorOf(ids.kasirA), id)).ok).toBe(true);
    expect(Number((await sql`select count(*) from hris.announcement_reads where announcement_id = ${id}`)[0].count)).toBe(1);
    expect(await unreadIds(ids.kasirA)).not.toContain(id);
  });

  it('orang pindah cabang ikut jadi sasaran; yang sudah membaca tetap melihatnya di papan', async () => {
    const id = await publish(ids.hr, { title: 'Untuk Tasik', target: { all: false, branchIds: [branchB], positionIds: [] } });
    expect(await unreadIds(ids.kasirB)).toContain(id);
    expect((await svc.markAnnouncementRead(await actorOf(ids.kasirB), id)).ok).toBe(true);
    expect(await unreadIds(ids.mover)).toContain(id);
    await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
      values (${ids.kasirB}, 'BRANCH', ${branchA}, ${kasirPos}, 'EMPLOYEE', ${today()})`;
    const board = await svc.ruleBoard(await actorOf(ids.kasirB), 'current');
    if (!board.ok) throw new Error(board.error);
    expect(board.value.rules.map((r) => r.id)).toContain(id);
  });

  it('ralat: yang lama Diralat, semua sasaran membaca lagi', async () => {
    const id = await publish(ids.hr, { title: 'Aturan salah ketik', target: { all: true } });
    expect((await svc.markAnnouncementRead(await actorOf(ids.kepalaA), id)).ok).toBe(true);
    const started = await svc.startCorrection(await actorOf(ids.hr), id);
    if (!started.ok) throw new Error(started.error);
    expect((await svc.updateDraft(await actorOf(ids.hr), started.value.draftId, draftInput({ title: 'Aturan benar', target: { all: true } }))).ok).toBe(true);
    const published = await svc.publishDraft(await actorOf(ids.hr), started.value.draftId, 'now');
    if (!published.ok) throw new Error(published.error);
    expect(await unreadIds(ids.kepalaA)).toEqual(expect.arrayContaining([published.value.announcementId]));
    expect(await unreadIds(ids.kepalaA)).not.toContain(id);
    const old = await svc.ruleReaders(await actorOf(ids.hr), id);
    if (!old.ok) throw new Error(old.error);
    expect(old.value.rule.status).toBe('CORRECTED');
    expect(old.value.rule.correctedById).toBe(published.value.announcementId);
    expect(await svc.startCorrection(await actorOf(ids.hr), id)).toMatchObject({ ok: false, status: 409 });
  });

  it('tarik sebelum berlaku; sesudah berlaku ditolak', async () => {
    const id = await publish(ids.hr, { title: 'Akan ditarik' });
    expect(await svc.withdrawRule(await actorOf(ids.adminHr), id, 'Batal saja ya')).toMatchObject({ ok: false, status: 403 });
    expect((await svc.withdrawRule(await actorOf(ids.hr), id, 'Rapat membatalkan')).ok).toBe(true);
    expect(await unreadIds(ids.kasirA)).not.toContain(id);
    expect(await svc.withdrawRule(await actorOf(ids.hr), id, 'Rapat membatalkan')).toMatchObject({ ok: false, status: 409 });
    // Aturan yang sudah berlaku (dibuat langsung di DB dengan tanggal lampau).
    const [{ id: old }] = await sql`insert into hris.announcements (kind, title, message, target_all, shows_from, before_text, ask_whom, effective_on,
      change_kind, affects_money, created_by_account_id, created_by_employee_id)
      values ('RULE', 'Lama', 'Baru', true, now() - interval '10 days', 'Dulu', 'HR', ${addDays(today(), -1)}, 'FAVORABLE', false, 1, ${ids.hr}) returning id`;
    expect(await svc.withdrawRule(await actorOf(ids.hr), Number(old), 'Rapat membatalkan')).toMatchObject({ ok: false, status: 409 });
  });

  it('uang oleh HR: harus disetujui; Pemilik menyetujui → terbit; ditolak → konsep ditutup', async () => {
    const money = { affectsMoney: true, title: 'Tarif lembur turun' };
    const draftId = await write(ids.hr, money);
    expect(await svc.publishDraft(await actorOf(ids.hr), draftId, 'now')).toMatchObject({ ok: false, status: 400 });
    const handler = svc.ruleAnnouncementHandler() as unknown as Parameters<typeof requestsSvc.submitRequest>[2];
    const submitted = await requestsSvc.submitRequest(await actorOf(ids.hr), 'rule_announcement', handler, { fields: { draftId }, attachmentIds: [] });
    if (!submitted.ok) throw new Error(submitted.error);
    const [{ version }] = await sql`select version from hris.requests where id = ${submitted.data.id}`;
    const approved = await requestsSvc.decideRequest(await actorOf(ids.owner), submitted.data.id, handlers(), { decision: 'APPROVE', expectedVersion: Number(version) });
    if (!approved.ok) throw new Error(approved.error);
    const [draft] = await sql`select status, announcement_id from hris.announcement_drafts where id = ${draftId}`;
    expect(draft.status).toBe('PUBLISHED');
    expect(await unreadIds(ids.kasirA)).toContain(Number(draft.announcement_id));

    // Pemilik menulis uang: langsung terbit.
    expect((await svc.publishDraft(await actorOf(ids.owner), await write(ids.owner, money), 'now')).ok).toBe(true);

    const rejectedId = await write(ids.hr, money);
    const again = await requestsSvc.submitRequest(await actorOf(ids.hr), 'rule_announcement', handler, { fields: { draftId: rejectedId }, attachmentIds: [] });
    if (!again.ok) throw new Error(again.error);
    const [{ version: v2 }] = await sql`select version from hris.requests where id = ${again.data.id}`;
    expect((await requestsSvc.decideRequest(await actorOf(ids.owner), again.data.id, handlers(), { decision: 'REJECT', expectedVersion: Number(v2), reason: 'Belum dibahas rapat' })).ok).toBe(true);
    const [closed] = await sql`select status from hris.announcement_drafts where id = ${rejectedId}`;
    expect(closed.status).toBe('REJECTED');
    expect((await svc.copyRejectedDraft(await actorOf(ids.hr), rejectedId)).ok).toBe(true);
  });

  it('akses terbatas tidak mendapat papan dan butir belum dibaca', async () => {
    const actor = await actorOf(ids.kasirA);
    expect(await svc.unreadAnnouncements({ ...actor, limited: { since: '2026-11-01' } })).toEqual([]);
    expect((await svc.ruleBoard({ ...actor, limited: { since: '2026-11-01' } }, 'current')).ok).toBe(false);
  });

  it('DB menolak ubah isi pengumuman aturan', async () => {
    const [{ id }] = await sql`select id from hris.announcements where kind = 'RULE' order by id limit 1`;
    await expect(sql`update hris.announcements set effective_on = effective_on + 1 where id = ${id}`).rejects.toThrow(/tidak boleh diubah/);
    await expect(sql`insert into hris.announcements (kind, title, message, target_all, created_by_account_id, created_by_employee_id)
      values ('RULE', 'x', 'y', true, 1, 1)`).rejects.toThrow(/announcements_rule_complete/);
  });
});
