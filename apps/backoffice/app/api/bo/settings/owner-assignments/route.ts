import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  db,
  users,
  roles,
  branches,
  ownerAssignments,
  auditLogs,
  eq,
  and,
  asc,
  isNotNull,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const PERM = 'user.manage'

const putSchema = z.object({
  branchId: z.number().int().positive({ message: 'branchId wajib' }),
  // null → unassign owner cabang ini
  userId: z.number().int().positive().nullable(),
})

// Susunan owner per cabang. Sengaja LIST semua cabang (aktif maupun tidak) supaya
// OWNER bisa mengoreksi cabang yang sedang dijeda. Kandidat owner dibatasi pada
// pengguna dengan role OWNER + PIN sudah diset — tanpa PIN, `validate-pin` tetap
// akan tolak void jadi pilihannya tak berguna.
export async function GET() {
  try {
    const gate = await requirePermission(PERM)
    if (gate instanceof NextResponse) return gate
    const payload = gate

    // Assignment owner lintas-cabang: hanya boleh oleh pengguna berlingkup ALL
    // (biasanya OWNER). Cegah manager satu-cabang menyentuh cabang lain.
    if (payload.branchScope !== 'ALL') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const branchRows = await db
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
        isActive: branches.isActive,
      })
      .from(branches)
      .orderBy(asc(branches.name))

    const assignmentRows = await db
      .select({
        branchId: ownerAssignments.branchId,
        userId: users.id,
        userName: users.name,
        username: users.username,
      })
      .from(ownerAssignments)
      .innerJoin(users, eq(users.id, ownerAssignments.userId))
      .where(eq(ownerAssignments.isActive, true))

    const currentByBranch = new Map<number, { id: number; name: string; username: string }>()
    for (const row of assignmentRows) {
      currentByBranch.set(row.branchId, {
        id: row.userId,
        name: row.userName,
        username: row.username,
      })
    }

    const ownerRows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        pinHash: users.pinHash,
        isActive: users.isActive,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(and(eq(roles.name, 'OWNER'), eq(users.isActive, true), isNotNull(users.pinHash)))
      .orderBy(asc(users.name))

    return NextResponse.json({
      branches: branchRows.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        isActive: b.isActive,
        currentOwner: currentByBranch.get(b.id) ?? null,
      })),
      eligibleOwners: ownerRows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
      })),
    })
  } catch (error) {
    console.error('GET /api/bo/settings/owner-assignments error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memuat data' }, { status: 500 })
  }
}

// Assign/unassign owner untuk satu cabang. Atomik: nonaktifkan semua baris aktif
// cabang tsb, lalu masukkan baris baru jika userId non-null. Row lama tetap disimpan
// (isActive=false) sebagai jejak riwayat kepemilikan.
export async function PUT(req: NextRequest) {
  try {
    const gate = await requirePermission(PERM)
    if (gate instanceof NextResponse) return gate
    const payload = gate

    if (payload.branchScope !== 'ALL') {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 }
      )
    }

    const { branchId, userId } = parsed.data

    const [branch] = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1)

    if (!branch) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    if (userId !== null) {
      const [target] = await db
        .select({
          id: users.id,
          name: users.name,
          pinHash: users.pinHash,
          isActive: users.isActive,
          roleName: roles.name,
        })
        .from(users)
        .innerJoin(roles, eq(roles.id, users.roleId))
        .where(eq(users.id, userId))
        .limit(1)

      if (!target) {
        return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
      }
      if (target.roleName !== 'OWNER') {
        return NextResponse.json(
          { error: 'Pengguna bukan OWNER' },
          { status: 400 }
        )
      }
      if (!target.isActive) {
        return NextResponse.json({ error: 'Pengguna sudah nonaktif' }, { status: 400 })
      }
      if (!target.pinHash) {
        return NextResponse.json(
          { error: 'Owner belum memiliki PIN. Set PIN dahulu di halaman Ganti PIN.' },
          { status: 400 }
        )
      }
    }

    const [previous] = await db
      .select({ userId: ownerAssignments.userId })
      .from(ownerAssignments)
      .where(and(eq(ownerAssignments.branchId, branchId), eq(ownerAssignments.isActive, true)))
      .limit(1)

    await db.transaction(async (trx) => {
      await trx
        .update(ownerAssignments)
        .set({ isActive: false })
        .where(
          and(eq(ownerAssignments.branchId, branchId), eq(ownerAssignments.isActive, true))
        )

      if (userId !== null) {
        await trx.insert(ownerAssignments).values({
          branchId,
          userId,
          assignedBy: payload.userId,
          isActive: true,
        })
      }

      await trx.insert(auditLogs).values({
        branchId,
        userId: payload.userId,
        action: userId === null ? 'OWNER_ASSIGNMENT_CLEARED' : 'OWNER_ASSIGNMENT_SET',
        tableName: 'owner_assignments',
        recordId: String(branchId),
        oldData: previous ? JSON.stringify({ userId: previous.userId }) : null,
        newData: JSON.stringify({ userId }),
      })
    })

    return NextResponse.json({ ok: true, branchId, userId })
  } catch (error) {
    console.error('PUT /api/bo/settings/owner-assignments error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan penugasan owner' },
      { status: 500 }
    )
  }
}
