import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as argon2 from 'argon2'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import {
  db,
  users,
  roles,
  permissions,
  rolePermissions,
  userPermissions,
  eq,
  and,
  or,
  inArray,
  isNotNull,
} from '@/lib/db'
import {
  TransactionEditService,
  TransactionEditError,
} from '@/lib/services/transaction-edit-service'

export const dynamic = 'force-dynamic'

const TRANSACTION_EDIT_PERMISSION = 'transaction.edit'

const editSchema = z.object({
  reason: z.string().min(3, 'Alasan koreksi wajib diisi').max(500, 'Alasan maksimal 500 karakter'),
  pin: z.string().min(4, 'PIN tidak valid').max(6, 'PIN tidak valid'),
  items: z
    .array(
      z.object({
        transactionItemId: z.number().int().positive().nullable(),
        productId: z.number().int().positive(),
        uomId: z.number().int().positive(),
        qty: z.number().int().positive('Qty item harus lebih dari 0'),
        unitPrice: z.number().int().nonnegative(),
        discountAmount: z.number().int().nonnegative(),
        priceTier: z.string().min(1),
      }),
    )
    .min(1, 'Transaksi harus tetap memiliki minimal satu item'),
  payments: z
    .array(
      z.object({
        paymentMethodId: z.number().int().positive(),
        amount: z.number().int().nonnegative(),
        referenceNumber: z.string().nullable().optional(),
      }),
    )
    .min(1, 'Pembayaran wajib diisi'),
  customerId: z.number().int().positive().nullable().optional(),
  dueAt: z.string().nullable().optional(),
})

const STATUS_BY_CODE: Record<string, number> = {
  TRX_NOT_FOUND: 404,
  TRX_NOT_COMPLETED: 409,
  SHIFT_CLOSED: 409,
  HAS_RETURN: 409,
  DEBT_HAS_PAYMENT: 409,
  LINKED_SOURCE: 409,
}

/**
 * Cari user yang berwenang menyetujui koreksi di cabang ini, lalu cocokkan PIN-nya.
 * Kewenangan berasal dari izin `transaction.edit` — lewat role maupun grant per orang.
 * Mengembalikan id penyetuju, atau null bila tidak ada PIN yang cocok.
 */
async function resolveApprover(branchId: number, pin: string): Promise<number | null> {
  const [permission] = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.code, TRANSACTION_EDIT_PERMISSION))
    .limit(1)

  if (!permission) return null

  const [roleGrants, userGrants] = await Promise.all([
    db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(eq(rolePermissions.permissionId, permission.id)),
    db
      .select({ userId: userPermissions.userId })
      .from(userPermissions)
      .where(eq(userPermissions.permissionId, permission.id)),
  ])

  const roleIds = roleGrants.map((r) => r.roleId)
  const userIds = userGrants.map((u) => u.userId)
  if (roleIds.length === 0 && userIds.length === 0) return null

  const authorityFilter =
    roleIds.length > 0 && userIds.length > 0
      ? or(inArray(users.roleId, roleIds), inArray(users.id, userIds))
      : roleIds.length > 0
        ? inArray(users.roleId, roleIds)
        : inArray(users.id, userIds)

  // Penyetuju harus berada di cabang yang sama, kecuali OWNER/GM yang cakupannya lintas cabang.
  const candidates = await db
    .select({ id: users.id, pinHash: users.pinHash })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(
      and(
        eq(users.isActive, true),
        isNotNull(users.pinHash),
        authorityFilter,
        or(eq(users.branchId, branchId), inArray(roles.name, ['OWNER', 'GM'])),
      ),
    )
    .limit(30)

  for (const candidate of candidates) {
    if (!candidate.pinHash) continue
    try {
      if (await argon2.verify(candidate.pinHash, pin)) return candidate.id
    } catch {
      // hash rusak/format lama — lewati, jangan gagalkan seluruh proses
    }
  }

  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null

    if (!payload) {
      return NextResponse.json(
        { error: 'Sesi tidak valid, silakan login kembali' },
        { status: 401 },
      )
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type harus application/json' },
        { status: 415 },
      )
    }

    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }
    const txId = parseInt(id, 10)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = editSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data koreksi tidak valid' },
        { status: 400 },
      )
    }

    const branchId = getPosBranchId(payload, cookieStore)

    const approverId = await resolveApprover(branchId, parsed.data.pin)
    if (!approverId) {
      // Jeda 1 detik untuk mitigasi brute force (sama seperti jalur void)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json(
        { error: 'PIN tidak cocok dengan petugas yang berwenang mengoreksi transaksi' },
        { status: 403 },
      )
    }

    const result = await TransactionEditService.editTransaction({
      txId,
      branchId,
      actorUserId: payload.userId,
      approvedById: approverId,
      reason: parsed.data.reason,
      items: parsed.data.items,
      payments: parsed.data.payments,
      customerId: parsed.data.customerId ?? null,
      dueAt: parsed.data.dueAt ?? null,
    })

    return NextResponse.json({
      success: true,
      message: `Transaksi ${result.trxNumber} berhasil dikoreksi`,
      ...result,
    })
  } catch (error: unknown) {
    if (error instanceof TransactionEditError) {
      return NextResponse.json(
        { error: error.message },
        { status: STATUS_BY_CODE[error.code] ?? 400 },
      )
    }
    console.error('[transaction-edit] POST error:', error)
    return NextResponse.json({ error: 'Gagal mengoreksi transaksi' }, { status: 500 })
  }
}
