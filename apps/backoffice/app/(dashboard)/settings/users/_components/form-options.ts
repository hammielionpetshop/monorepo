import { db, roles, branches, eq } from '@/lib/db'
import type { RoleOption, BranchOption } from './types'

/**
 * Pilihan role & cabang untuk form pengguna. Dipakai halaman tambah DAN halaman edit —
 * disatukan di sini supaya keduanya tidak bisa menyimpang, terutama saringan
 * `isActive` pada cabang: menawarkan cabang nonaktif akan ditolak server (400).
 */
export async function getUserFormOptions(): Promise<{
  roles: RoleOption[]
  branches: BranchOption[]
}> {
  const [roleOptions, branchOptions] = await Promise.all([
    db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name),
    db
      .select({ id: branches.id, code: branches.code, name: branches.name })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(branches.name),
  ])
  return { roles: roleOptions, branches: branchOptions }
}
