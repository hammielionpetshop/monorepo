import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { getDefaultCredentials, setSetting } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

// Guard `user.manage` (OWNER-only) — default kredensial staf setara sensitif dengan
// manajemen user; keduanya dikelola pihak yang sama.
const PERM = 'user.manage'

const updateSchema = z.object({
  defaultPassword: z.string().trim().min(6, 'Password default minimal 6 karakter').max(100, 'Password default maksimal 100 karakter'),
  defaultPin: z.string().trim().regex(/^\d{4,6}$/, 'PIN default harus 4–6 digit angka'),
})

export async function GET() {
  const gate = await requirePermission(PERM)
  if (gate instanceof NextResponse) return gate

  const { password, pin } = await getDefaultCredentials()
  return NextResponse.json({ defaultPassword: password, defaultPin: pin })
}

export async function PUT(req: NextRequest) {
  const gate = await requirePermission(PERM)
  if (gate instanceof NextResponse) return gate
  const payload = gate

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

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  try {
    await setSetting('default_password', parsed.data.defaultPassword, payload.userId)
    await setSetting('default_pin', parsed.data.defaultPin, payload.userId)
  } catch (error) {
    console.error('PUT /api/bo/settings/security error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan pengaturan' }, { status: 500 })
  }

  return NextResponse.json({ defaultPassword: parsed.data.defaultPassword, defaultPin: parsed.data.defaultPin })
}
