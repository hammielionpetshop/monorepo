import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { setHrisLinkedAccountActive } from '../../auth/src/credentials.ts'
import { addDays } from '../../../apps/hris/modules/employees/rules/dates.ts'
import { activeOn, placementOn } from '../../../apps/hris/modules/employees/rules/history.ts'

// HRIS L2c: data induk karyawan (migrasi hris 0002) — konversi fixture L2b, kode karyawan, pagar riwayat,
// view penempatan hari ini, dan akun pusat mengikuti status karyawan.
const requireAuth = createRequire(new URL('../../auth/package.json', import.meta.url))
const { drizzle } = requireAuth('drizzle-orm/postgres-js')
const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator')
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `hris_employees_test_${process.pid}_${Date.now()}`
const hrisMigrations = new URL('../../hris-db/src/migrations/', import.meta.url)
const authMigrations = new URL('../../auth/src/migrations/', import.meta.url)
let admin
let sql
let today
let ids

const runHris = async (file) => sql.unsafe(readFileSync(new URL(file, hrisMigrations), 'utf8')).simple()

async function rejects(statement) {
  await expect(sql.begin((tx) => tx.unsafe(statement))).rejects.toThrow()
}

async function employee(name, joinedOn, branchId, positionId, workStatus = 'EMPLOYEE') {
  const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, ${joinedOn}) returning *`
  await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
    values (${row.id}, 'INITIAL', ${branchId}, ${positionId}, ${workStatus}, ${joinedOn})`
  return row
}

describe.skipIf(!ADMIN_URL)('HRIS L2c: data induk karyawan', () => {
  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL)
    adminUrl.pathname = '/postgres'
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
    await admin.unsafe(`create database "${databaseName}"`)
    const url = new URL(ADMIN_URL)
    url.pathname = `/${databaseName}`
    sql = postgres(url.toString(), { max: 8, onnotice: () => {} })
    await sql`create schema petshop`
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} })
    await migrate(drizzle(migrationClient), { migrationsFolder: fileURLToPath(authMigrations), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth' })
    await migrationClient.end()
    await runHris('0000_init.sql')
    await runHris('0001_access.sql')

    // Keadaan staging sebelum L2c: dua penetapan sementara, satu bertautan akun, satu tanpa cabang.
    const [branch] = await sql`insert into hris.branches (name) values ('Toko Pusat') returning id`
    const [owner] = await sql`select id from hris.positions where name = 'Pemilik'`
    const [kasir] = await sql`select id from hris.positions where name = 'Kasir'`
    const [account] = await sql`insert into auth.accounts (username) values ('sundus') returning id`
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${account.id}, 'hris', 7)`
    await sql`insert into hris.interim_actor_positions (person_id, position_id, branch_id) values (7, ${owner.id}, ${branch.id}), (9, ${kasir.id}, null)`

    await runHris('0002_employees.sql')
    const [{ value }] = await sql`select (now() at time zone 'Asia/Jakarta')::date::text as value`
    today = value
    const [cikarang] = await sql`insert into hris.branches (name) values ('Toko Cikarang') returning id`
    ids = { pusat: branch.id, cikarang: cikarang.id, owner: owner.id, kasir: kasir.id, account: account.id }
  })

  afterAll(async () => {
    await sql?.end()
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`)
    await admin?.end()
  })

  it('penetapan sementara L2b menjadi karyawan fixture dengan id yang sama, lalu tabelnya dihapus', async () => {
    const rows = await sql`select e.id, e.code, e.name, e.source, p.kind, p.branch_id, p.position_id, p.work_status
      from hris.employees e join hris.placements p on p.employee_id = e.id order by e.id`
    expect(rows).toEqual([
      { id: 7, code: 'HML-0001', name: 'sundus', source: 'FIXTURE', kind: 'INITIAL', branch_id: ids.pusat, position_id: ids.owner, work_status: 'EMPLOYEE' },
      { id: 9, code: 'HML-0002', name: 'Karyawan fixture #9', source: 'FIXTURE', kind: 'INITIAL', branch_id: ids.pusat, position_id: ids.kasir, work_status: 'EMPLOYEE' },
    ])
    const [{ exists }] = await sql`select to_regclass('hris.interim_actor_positions') is not null as exists`
    expect(exists).toBe(false)
    const created = await employee('Karyawan Baru', today, ids.pusat, ids.kasir)
    expect(created.id).toBeGreaterThan(9)
    expect(created.code).toBe('HML-0003')
  })

  it('kode karyawan tidak kembar walau dibuat bersamaan, dan tidak bisa diubah (KAR-02)', async () => {
    const codes = await Promise.all(Array.from({ length: 20 }, () => sql`select hris.next_employee_code() as code`))
    const values = codes.map(([row]) => row.code)
    expect(new Set(values).size).toBe(20)
    await rejects(`update hris.employees set code = 'HML-9999' where id = 7`)
    await rejects(`update hris.employees set source = 'HRIS' where id = 7`)
    await sql`update hris.employees set name = 'Sundus' where id = 7`
  })

  it('karyawan dan riwayat tidak bisa dihapus atau dikosongkan (KAR-55, PRI-02)', async () => {
    // Trigger per baris hanya berjalan bila ada baris; isi satu baris di tiap tabel riwayat.
    await sql`insert into hris.field_permits (employee_id, kind, granted_by_account_id) values (9, 'DRIVE', 1)`
    await sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, note, created_by_account_id)
      values (9, 'DEACTIVATE', ${addDays(today, 400)}, 'OTHER', 'Uji pagar', 1)`
    await sql`insert into hris.training_reviews (employee_id, decision, review_again_on, reason, decided_by_account_id)
      values (9, 'DEFER', ${addDays(today, 30)}, 'Uji pagar', 1)`
    for (const table of ['employees', 'placements', 'employment_events', 'field_permits', 'training_reviews']) {
      await rejects(`delete from hris.${table}`)
      await rejects(`truncate hris.${table} cascade`)
    }
  })

  it('catatan penempatan hanya bisa dibatalkan sekali, selama belum berlaku, dan bukan penempatan awal (KAR-56)', async () => {
    const person = await employee('Rina', addDays(today, -30), ids.pusat, ids.kasir)
    const [future] = await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
      values (${person.id}, 'BRANCH', ${ids.cikarang}, ${ids.kasir}, 'EMPLOYEE', ${addDays(today, 5)}) returning id`
    const [past] = await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
      values (${person.id}, 'BRANCH', ${ids.cikarang}, ${ids.kasir}, 'EMPLOYEE', ${addDays(today, -1)}) returning id`
    await rejects(`update hris.placements set branch_id = ${ids.pusat} where id = ${future.id}`)
    await rejects(`update hris.placements set cancelled_at = now(), cancel_reason = 'x' where id = ${past.id}`)
    await rejects(`update hris.placements set cancelled_at = now(), cancel_reason = 'x' where employee_id = ${person.id} and kind = 'INITIAL'`)
    await sql`update hris.placements set cancelled_at = now(), cancel_reason = 'salah tanggal' where id = ${future.id}`
    await rejects(`update hris.placements set cancel_reason = 'ganti' where id = ${future.id}`)
  })

  it('riwayat status hanya boleh ditandai "akun sudah diikutkan" sekali; keputusan promosi tidak bisa diubah', async () => {
    const person = await employee('Budi', addDays(today, -60), ids.pusat, ids.kasir)
    const [event] = await sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, resignation_notice, note, created_by_account_id)
      values (${person.id}, 'DEACTIVATE', ${today}, 'RESIGNED', 'WITH_NOTICE', 'Pamit', 1) returning id`
    await rejects(`update hris.employment_events set note = 'ubah' where id = ${event.id}`)
    await sql`update hris.employment_events set account_applied_at = now() where id = ${event.id}`
    await rejects(`update hris.employment_events set account_applied_at = now() where id = ${event.id}`)
    await rejects(`insert into hris.employment_events (employee_id, kind, effective_on, note, created_by_account_id) values (${person.id}, 'DEACTIVATE', '${today}', 'tanpa alasan', 1)`)
    const [review] = await sql`insert into hris.training_reviews (employee_id, decision, review_again_on, reason, decided_by_account_id)
      values (${person.id}, 'DEFER', ${addDays(today, 30)}, 'Belum siap', 1) returning id`
    await rejects(`update hris.training_reviews set reason = 'ubah' where id = ${review.id}`)
  })

  it('view penempatan hari ini cocok dengan aturan aplikasi (W3, H13) dan pemakai mencakup catatan bertanggal depan', async () => {
    const moving = await employee('Pindah Bulan Depan', addDays(today, -10), ids.pusat, ids.kasir)
    await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
      values (${moving.id}, 'BRANCH', ${ids.cikarang}, ${ids.kasir}, 'EMPLOYEE', ${addDays(today, 1)})`
    const leaving = await employee('Keluar Hari Ini', addDays(today, -10), ids.cikarang, ids.kasir)
    await sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, note, created_by_account_id)
      values (${leaving.id}, 'DEACTIVATE', ${today}, 'OTHER', 'Uji', 1)`

    for (const person of [moving, leaving]) {
      const records = (await sql`select * from hris.placements where employee_id = ${person.id}`).map((r) => ({
        id: r.id, kind: r.kind, branchId: r.branch_id, positionId: r.position_id, workStatus: r.work_status,
        effectiveFrom: r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : r.effective_from,
        cancelledAt: r.cancelled_at,
      }))
      const events = (await sql`select id, kind, effective_on::text as effective_on from hris.employment_events where employee_id = ${person.id}`)
        .map((e) => ({ id: e.id, kind: e.kind, effectiveOn: e.effective_on }))
      const [view] = await sql`select branch_id, active from hris.current_placements where employee_id = ${person.id}`
      expect(view.branch_id).toBe(placementOn(records, today).branchId)
      expect(view.active).toBe(activeOn(events, today))
    }
    const [movingView] = await sql`select branch_id from hris.current_placements where employee_id = ${moving.id}`
    expect(movingView.branch_id).toBe(ids.pusat)

    const holders = await sql`select employee_id, branch_id, current from hris.placement_holders where employee_id in ${sql([moving.id, leaving.id])} order by employee_id, current desc`
    expect(holders).toEqual([
      { employee_id: moving.id, branch_id: ids.pusat, current: true },
      { employee_id: moving.id, branch_id: ids.cikarang, current: false },
    ])
  })

  it('akun pusat bertaut mengikuti status karyawan: nonaktif mencabut sesi, aktif lagi memakai akun lama (KAR-07, 69)', async () => {
    const [session] = await sql`insert into auth.sessions (account_id, token_hash, auth_method, expires_at)
      values (${ids.account}, ${'a'.repeat(64)}, 'PASSWORD', now() + interval '1 day') returning id`
    const off = await setHrisLinkedAccountActive(sql, { employeeId: 7, active: false, actorAccountId: null, reason: 'uji nonaktif' })
    expect(off).toEqual({ ok: true, accountId: ids.account, changed: true })
    const [state] = await sql`select a.is_active, s.revoked_reason from auth.accounts a join auth.sessions s on s.account_id = a.id where s.id = ${session.id}`
    expect(state).toEqual({ is_active: false, revoked_reason: 'ACCOUNT_DISABLED' })
    expect(await setHrisLinkedAccountActive(sql, { employeeId: 7, active: false, actorAccountId: null, reason: 'ulang' }))
      .toEqual({ ok: true, accountId: ids.account, changed: false })
    expect(await setHrisLinkedAccountActive(sql, { employeeId: 7, active: true, actorAccountId: ids.account, reason: 'uji aktif' }))
      .toEqual({ ok: true, accountId: ids.account, changed: true })
    const audits = await sql`select action, actor_account_id from auth.audit_events where account_id = ${ids.account} order by id`
    expect(audits).toEqual([
      { action: 'ACCOUNT_DISABLED', actor_account_id: null },
      { action: 'ACCOUNT_ENABLED', actor_account_id: ids.account },
    ])
    expect(await setHrisLinkedAccountActive(sql, { employeeId: 9, active: false, actorAccountId: null, reason: 'tanpa akun' }))
      .toEqual({ ok: true, accountId: null, changed: false })
    expect((await setHrisLinkedAccountActive(sql, { employeeId: 0, active: false, actorAccountId: null, reason: 'x' })).ok).toBe(false)
  })

  it('kode sesudah 9999 lanjut tanpa dipotong', async () => {
    await sql`select setval('hris.employee_code_seq', 9999)`
    const [{ code }] = await sql`select hris.next_employee_code() as code`
    expect(code).toBe('HML-10000')
  })
})
