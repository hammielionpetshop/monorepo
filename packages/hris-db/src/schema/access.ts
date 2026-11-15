import { sql } from 'drizzle-orm';
import {
  boolean, check, doublePrecision, index, integer, jsonb, serial, text, timestamp, uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Modul akses (spec L2b §2). Tidak ada hapus: yang berhenti dipakai ditandai active = false.

export const accessScope = hrisSchema.enum('access_scope', ['SELF', 'BRANCH', 'DEPARTMENT', 'ALL']);
// Pelaku jejak: orang (akun) atau mesin terjadwal (spec L2e §2.2).
export const auditSource = hrisSchema.enum('audit_source', ['USER', 'JOB']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const departments = hrisSchema.table(
  'departments',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('departments_name_unique').on(sql`lower(${t.name})`),
    check('departments_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

export const branches = hrisSchema.table(
  'branches',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    address: text('address'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    // id cabang kasir (petshop.branches); sengaja tanpa FK lintas schema.
    kasirBranchId: integer('kasir_branch_id'),
    mergedIntoBranchId: integer('merged_into_branch_id').references((): AnyPgColumn => branches.id),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('branches_name_unique').on(sql`lower(${t.name})`),
    uniqueIndex('branches_kasir_branch_unique').on(t.kasirBranchId).where(sql`${t.kasirBranchId} is not null`),
    check('branches_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('branches_location_pair', sql`(${t.latitude} is null) = (${t.longitude} is null)`),
    check('branches_latitude_range', sql`${t.latitude} between -90 and 90`),
    check('branches_longitude_range', sql`${t.longitude} between -180 and 180`),
    check('branches_not_merged_into_self', sql`${t.mergedIntoBranchId} <> ${t.id}`),
  ],
);

export const positions = hrisSchema.table(
  'positions',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    departmentId: integer('department_id').notNull().references(() => departments.id),
    highRights: boolean('high_rights').notNull().default(false),
    // Pemilik dan GM: memegang semua tindakan dari bendera ini, bukan dari baris hak (KAR-67/71).
    fullAccess: boolean('full_access').notNull().default(false),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('positions_name_unique').on(sql`lower(${t.name})`),
    index('positions_department_idx').on(t.departmentId),
    check('positions_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('positions_full_access_is_high_rights', sql`not ${t.fullAccess} or ${t.highRights}`),
  ],
);

// Tidak ada baris = tidak ada hak.
export const positionGrants = hrisSchema.table(
  'position_grants',
  {
    id: serial('id').primaryKey(),
    positionId: integer('position_id').notNull().references(() => positions.id),
    action: text('action').notNull(),
    scope: accessScope('scope').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('position_grants_position_action_unique').on(t.positionId, t.action)],
);

// Jejak perubahan bersama modul HRIS. Hanya tambah baris (trigger menolak UPDATE/DELETE).
export const auditEvents = hrisSchema.table(
  'audit_events',
  {
    id: serial('id').primaryKey(),
    // Null hanya bila source = JOB.
    actorAccountId: integer('actor_account_id'),
    source: auditSource('source').notNull().default('USER'),
    jobName: text('job_name'),
    entity: text('entity').notNull(),
    entityId: integer('entity_id'),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_events_entity_idx').on(t.entity, t.entityId, t.createdAt),
    check('audit_events_actor_matches_source', sql`(${t.source} = 'USER' and ${t.actorAccountId} is not null and ${t.jobName} is null)
      or (${t.source} = 'JOB' and ${t.jobName} is not null)`),
  ],
);
