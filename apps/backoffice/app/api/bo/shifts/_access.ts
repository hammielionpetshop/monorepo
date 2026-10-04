import { NextResponse } from 'next/server'
import { getAuth, hasPermission } from '@/lib/authz'
import type { JWTPayload } from '@petshop/shared'

/**
 * Riwayat shift bisa dibaca pemegang `shift.read` (lintas cabang) atau `shift.deposit.verify`
 * (finance yang menerima setoran). Cakupan cabangnya tetap mengikuti `branchScope`.
 */
export async function requireShiftAccess(): Promise<JWTPayload | NextResponse> {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  if (!hasPermission(payload, 'shift.read') && !hasPermission(payload, 'shift.deposit.verify')) {
    return NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 })
  }
  return payload
}
