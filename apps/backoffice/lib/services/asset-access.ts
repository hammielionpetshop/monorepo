import { NextResponse } from 'next/server'
import { hasPermission, type getAuth } from '@/lib/authz'
import { AssetError, type AssetActor } from './asset-service'

/**
 * Akses Aset F2-6d-1 (spec docs/work/specs/2026-11-12-f2-6d-aset-penyusutan-design.md §0 butir 10), memakai hak Arus
 * Kas yang sudah ada agar tidak perlu keluar-masuk: catat = `cashflow.record` (Owner/GM/Finance), ubah keadaan &
 * batal = `cashflow.cancel` (Owner/GM).
 */

type Payload = NonNullable<Awaited<ReturnType<typeof getAuth>>>

export function canViewAssets(payload: Payload): boolean {
  return hasPermission(payload, 'cashflow.record') || hasPermission(payload, 'cashflow.cancel')
}

export function canRecordAssets(payload: Payload): boolean {
  return hasPermission(payload, 'cashflow.record')
}

export function canDisposeAssets(payload: Payload): boolean {
  return hasPermission(payload, 'cashflow.cancel')
}

export function assetActorOf(payload: Payload): AssetActor {
  return { userId: payload.userId, canBackdate: ['OWNER', 'GM'].includes(payload.role) }
}

export function assetErrorResponse(error: unknown, where: string, fallback: string) {
  if (error instanceof AssetError) return NextResponse.json({ error: error.message }, { status: error.status })
  console.error(`${where} error:`, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}
