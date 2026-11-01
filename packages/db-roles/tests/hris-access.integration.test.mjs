import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import postgres from 'postgres'
import { can } from '../../../apps/hris/modules/access/rules/can.ts'
import { ACTIONS, ACTION_NAMES } from '../../../apps/hris/modules/access/rules/actions.ts'

// HRIS L2b: kunci jawaban hak awal (KAR-63, WAJ-06) dan pagar data di migrasi hris 0001.
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `hris_access_test_${process.pid}_${Date.now()}`
const migrationDirectory = new URL('../../hris-db/src/migrations/', import.meta.url)
let admin
let sql

// Ditulis ulang dari tabel §5 spec karyawan-dan-akses v3, terpisah dari isi migrasi.
const EVERY_EMPLOYEE = {
  'profile.view': 'SELF', 'contact.update_own': 'SELF', 'identity_change.request': 'SELF',
  'own_account.manage': 'SELF', 'extra_rights.view': 'SELF', 'report_guide.view': 'ALL',
  'login_history.view_own': 'SELF',
  'attendance.my_schedule.view': 'SELF', 'attendance.self.check': 'SELF',
}
const HR_RIGHTS = {
  ...EVERY_EMPLOYEE,
  'profile.view': 'ALL', 'identity_change.decide': 'ALL', 'employee.list': 'ALL', 'employee.update': 'ALL',
  'placement.record': 'ALL', 'employee.activation': 'ALL', 'resignation.propose_unnotified': 'ALL',
  'field_permit.update': 'ALL', 'registration.decide': 'ALL', 'training_promotion.decide': 'ALL',
  'freelancer.manage': 'ALL', 'sessions.revoke': 'ALL', 'position_settings.propose': 'ALL', 'org.manage': 'ALL',
}
const ANSWER_KEY = {
  HR: {
    ...HR_RIGHTS, 'attendance.work_hours.view': 'ALL', 'attendance.work_hours.update': 'ALL', 'attendance.schedule.view': 'ALL',
    'attendance.schedule.update': 'ALL', 'attendance.location.view': 'ALL', 'attendance.qr.manage': 'ALL',
    'attendance.closure.view': 'ALL', 'attendance.closure.manage': 'ALL',
    'attendance.assist.view': 'ALL', 'attendance.photo.view': 'ALL', 'attendance.attempts.view': 'ALL',
  },
  'Admin HR': {
    ...HR_RIGHTS, 'attendance.work_hours.view': 'ALL', 'attendance.schedule.view': 'ALL', 'attendance.location.view': 'ALL',
    'attendance.closure.view': 'ALL', 'attendance.assist.view': 'ALL',
  },
  Finance: { ...EVERY_EMPLOYEE, 'temp_report_right.grant': 'ALL', 'extra_rights.view': 'ALL', 'attendance.closure.view': 'ALL' },
  Marketing: EVERY_EMPLOYEE,
  'Kepala Gudang': {
    ...EVERY_EMPLOYEE, 'employee.directory': 'ALL', 'field_permit.update': 'ALL', 'freelancer.manage': 'ALL',
    'attendance.schedule.view': 'DEPARTMENT', 'attendance.schedule.update': 'DEPARTMENT', 'attendance.closure.view': 'DEPARTMENT',
    'attendance.assist.view': 'DEPARTMENT', 'attendance.photo.view': 'DEPARTMENT',
  },
  Driver: EVERY_EMPLOYEE,
  Kenek: EVERY_EMPLOYEE,
  'Kepala Toko': {
    ...EVERY_EMPLOYEE, 'attendance.schedule.view': 'BRANCH', 'attendance.schedule.update': 'BRANCH', 'attendance.closure.view': 'BRANCH',
    'attendance.assist.view': 'BRANCH', 'attendance.photo.view': 'BRANCH',
  },
  Kasir: EVERY_EMPLOYEE,
  Pramuniaga: EVERY_EMPLOYEE,
  Groomer: EVERY_EMPLOYEE,
  'Belum ditentukan': EVERY_EMPLOYEE,
}
const FULL_ACCESS = ['Pemilik', 'GM']
const HIGH_RIGHTS = ['Pemilik', 'GM', 'HR', 'Finance']

const ME = 10
const TARGETS = {
  self: { personId: ME, branchId: 1, departmentId: 1 },
  sameBranch: { personId: 11, branchId: 1, departmentId: 1 },
  otherBranch: { personId: 12, branchId: 2, departmentId: 2 },
}

function expected(positionName, action, targetKind) {
  const definition = ACTIONS[action]
  if (definition.selfForbidden && targetKind === 'self') return false
  if (FULL_ACCESS.includes(positionName)) return true
  const scope = ANSWER_KEY[positionName][action]
  if (!scope || definition.ownerOnly) return false
  if (scope === 'BRANCH' || scope === 'DEPARTMENT') return targetKind !== 'otherBranch'
  return scope === 'ALL' || targetKind === 'self'
}

function migrationStatements(file) {
  return readFileSync(new URL(file, migrationDirectory), 'utf8').split('--> statement-breakpoint')
}

async function actorFor(position) {
  const grants = await sql`select action, scope from hris.position_grants where position_id = ${position.id}`
  return {
    accountId: 1, personId: ME, positionId: position.id, fullAccess: position.full_access,
    highRights: position.high_rights, branchId: 1, departmentId: 1,
    grants: new Map(grants.map((g) => [g.action, g.scope])),
  }
}

async function rejects(statement) {
  await expect(sql.begin((tx) => tx.unsafe(statement))).rejects.toThrow()
}

describe.skipIf(!ADMIN_URL)('HRIS L2b: hak akses, cabang, jabatan', () => {
  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL)
    adminUrl.pathname = '/postgres'
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
    await admin.unsafe(`create database "${databaseName}"`)
    const url = new URL(ADMIN_URL)
    url.pathname = `/${databaseName}`
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} })
    // Sumber minimal untuk view cabang kasir; aliran petshop sungguhan berjalan lebih dulu saat deploy.
    await sql`create schema petshop`
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`
    await sql`insert into petshop.branches (code, name) values ('TOKO-PUSAT', 'Toko Pusat'), ('GUDANG', 'Gudang')`
    for (const file of readdirSync(migrationDirectory).filter((f) => f.endsWith('.sql')).sort()) {
      await sql.unsafe(readFileSync(new URL(file, migrationDirectory), 'utf8')).simple()
    }
  })

  afterAll(async () => {
    await sql?.end()
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`)
    await admin?.end()
  })

  it('jabatan dan departemen awal sesuai H7/H7a', async () => {
    const rows = await sql`select p.name, d.name as department, p.high_rights, p.full_access
      from hris.positions p join hris.departments d on d.id = p.department_id order by p.id`
    expect(rows.map((r) => r.name).sort()).toEqual([...FULL_ACCESS, ...Object.keys(ANSWER_KEY)].sort())
    for (const row of rows) {
      expect(row.full_access).toBe(FULL_ACCESS.includes(row.name))
      expect(row.high_rights).toBe(HIGH_RIGHTS.includes(row.name))
    }
    expect(new Set(rows.map((r) => r.department))).toEqual(new Set(['Office', 'Team Gudang', 'Team Toko']))
  })

  it('baris hak awal persis sama dengan kunci jawaban, dan hanya memakai tindakan yang terdaftar', async () => {
    const rows = await sql`select p.name, g.action, g.scope from hris.position_grants g
      join hris.positions p on p.id = g.position_id`
    const actual = {}
    for (const row of rows) {
      expect(ACTION_NAMES).toContain(row.action)
      actual[row.name] = { ...actual[row.name], [row.action]: row.scope }
    }
    expect(actual).toEqual(ANSWER_KEY)
  })

  it('setiap tindakan dicoba sebagai tiap jabatan pada data sendiri, cabang sama, dan cabang lain', async () => {
    const positions = await sql`select id, name, full_access, high_rights from hris.positions`
    const mismatches = []
    for (const position of positions) {
      const actor = await actorFor(position)
      for (const action of ACTION_NAMES) {
        for (const [kind, target] of Object.entries(TARGETS)) {
          const result = can(actor, action, target)
          if (result !== expected(position.name, action, kind)) mismatches.push(`${position.name} ${action} ${kind}: ${result}`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })

  it('percobaan tetap: menaikkan hak sendiri dan tindakan Pemilik ditolak untuk jabatan lain', async () => {
    const [hr] = await sql`select id, name, full_access, high_rights from hris.positions where name = 'HR'`
    const actor = await actorFor(hr)
    expect(can(actor, 'position.grants.update')).toBe(false)
    expect(can(actor, 'position.high_rights.update')).toBe(false)
    expect(can(actor, 'placement.record', TARGETS.self)).toBe(false)
    expect(can(actor, 'employee.activation', TARGETS.self)).toBe(false)
    expect(can(null, 'profile.view', TARGETS.self)).toBe(false)
  })

  it('data awal idempoten: dijalankan ulang tidak menggandakan atau mengubah', async () => {
    const before = await sql`select position_id, action, scope from hris.position_grants order by 1, 2`
    const seed = migrationStatements('0001_access.sql').filter((s) => s.replace(/^\s*--.*$/gm, '').trim().startsWith('INSERT'))
    expect(seed.length).toBeGreaterThanOrEqual(4)
    for (const statement of seed) await sql.unsafe(statement)
    expect(await sql`select position_id, action, scope from hris.position_grants order by 1, 2`).toEqual(before)
    expect((await sql`select count(*)::int as n from hris.positions`)[0].n).toBe(14)
  })

  it('jabatan berhak penuh tidak bisa diberi baris hak, dan jabatan berhak tidak bisa dijadikan berhak penuh', async () => {
    await rejects(`insert into hris.position_grants (position_id, action, scope)
      select id, 'employee.list', 'ALL' from hris.positions where name = 'GM'`)
    await rejects(`update hris.positions set full_access = true, high_rights = true where name = 'Kasir'`)
    await rejects(`update hris.positions set high_rights = false where name = 'Pemilik'`)
  })

  it('jejak perubahan hanya tambah; cabang/departemen/jabatan tidak bisa dihapus', async () => {
    await sql`insert into hris.audit_events (actor_account_id, entity, entity_id, action) values (1, 'position_grant', 1, 'update')`
    await rejects(`update hris.audit_events set action = 'x'`)
    await rejects(`delete from hris.audit_events`)
    await rejects(`truncate hris.audit_events`)
    await rejects(`delete from hris.positions where name = 'Kasir'`)
    await rejects(`delete from hris.departments where name = 'Office'`)
    await sql`insert into hris.branches (name) values ('Cabang Uji Hapus')`
    await rejects(`delete from hris.branches where name = 'Cabang Uji Hapus'`)
  })

  it('nama unik tanpa beda huruf, titik lokasi berpasangan, dan view cabang kasir terbaca', async () => {
    await rejects(`insert into hris.departments (name) values ('office')`)
    await rejects(`insert into hris.positions (name, department_id) select 'kasir', id from hris.departments limit 1`)
    await rejects(`insert into hris.branches (name, latitude) values ('Cabang Setengah Titik', -6.2)`)
    const kasir = await sql`select code, name from hris.kasir_branches order by id`
    expect(kasir.map((k) => k.code)).toEqual(['TOKO-PUSAT', 'GUDANG'])
    await sql`insert into hris.branches (name, kasir_branch_id) values ('Toko Pusat', 1)`
    await rejects(`insert into hris.branches (name, kasir_branch_id) values ('Toko Pusat Kedua', 1)`)
  })
})
