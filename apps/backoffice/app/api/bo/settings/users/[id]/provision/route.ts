import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { isCentralMode } from '@/lib/central-cookie-name'
import { provisionUserAccount } from '@/lib/services/central-provisioning'
import { findAccountIdForUser } from '@/lib/services/central-session'

export const dynamic = 'force-dynamic'

// Mengulang pembuatan akun pusat bagi user yang tersimpan tetapi belum bertaut. Aman diulang.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('user.manage')
  if (gate instanceof NextResponse) return gate
  if (!isCentralMode()) {
    return NextResponse.json({ error: 'Akun pusat belum aktif di lingkungan ini.' }, { status: 409 })
  }
  const userId = Number((await params).id)
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'ID pengguna tidak valid.' }, { status: 400 })
  }
  try {
    const result = await provisionUserAccount({
      userId,
      idempotencyKey: `user-create:${userId}`,
      actorAccountId: await findAccountIdForUser(gate.userId),
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ accountId: result.accountId, created: result.created })
  } catch (error) {
    console.error('POST /api/bo/settings/users/[id]/provision error:', error)
    return NextResponse.json({ error: 'Layanan akun pusat tidak tersedia.' }, { status: 502 })
  }
}
