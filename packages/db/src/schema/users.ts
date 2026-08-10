import { serial, varchar, text, boolean, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core';
import { petshop } from './_schema';
import { branches } from './branches';

export const roles = petshop.table('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const permissions = petshop.table('permissions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
});

export const rolePermissions = petshop.table('role_permissions', {
  roleId: integer('role_id').references(() => roles.id).notNull(),
  permissionId: integer('permission_id').references(() => permissions.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
}));

export const users = petshop.table('users', {
  id: serial('id').primaryKey(),
  staffNumber: varchar('staff_number', { length: 50 }).unique(),
  username: varchar('username', { length: 50 }).unique(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  name: varchar('name', { length: 100 }).notNull(),
  roleId: integer('role_id').references(() => roles.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // First-login gate: user baru wajib ganti password + isi PIN sebelum akses halaman lain.
  mustChangeCredentials: boolean('must_change_credentials').default(true).notNull(),
  credentialsSetAt: timestamp('credentials_set_at'),
  // Gate khusus PIN: diset saat OWNER reset PIN staf. Berbeda dari `mustChangeCredentials`
  // yang memaksa ganti password SEKALIGUS PIN — reset PIN tidak boleh ikut membatalkan
  // password yang masih dipakai user.
  mustChangePin: boolean('must_change_pin').default(false).notNull(),
  pinSetAt: timestamp('pin_set_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ownerAssignments = petshop.table('owner_assignments', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  assignedBy: integer('assigned_by').references(() => users.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Grant izin ke user tertentu di luar izin bawaan role-nya. Dipakai untuk kewenangan
// yang ditunjuk per orang (mis. koreksi transaksi), bukan per jabatan. Saat login,
// kode izin di sini digabung dengan izin role ke dalam JWT.
export const userPermissions = petshop.table('user_permissions', {
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'cascade' }).notNull(),
  grantedBy: integer('granted_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.permissionId] }),
]);
