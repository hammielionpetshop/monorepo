import { randomBytes } from 'node:crypto'
import type { PriceChange, CostChange } from './price-service'

/**
 * Session store SEDERHANA in-memory untuk alur import preview → apply.
 * - Deploy topology: SINGLE container (lihat infra/apps/docker-compose.yml).
 *   Kalau nanti multi-instance atau perlu survive restart, ganti ke Redis/DB.
 * - TTL 15 menit. Cleanup lazy tiap akses + interval ringan.
 */

export interface PriceImportSession {
  id: string
  branchId: number
  changes: PriceChange[]
  costChanges: CostChange[]
  createdAt: number
  expiresAt: number
  createdBy: number
  fileName: string | null
}

const TTL_MS = 15 * 60 * 1000
const store = new Map<string, PriceImportSession>()

// Interval cleanup — hidup selama process hidup. Kalau tidak ada session, murah.
// unref() supaya tidak menahan event loop kalau server mau shutdown.
const cleanupInterval = setInterval(() => sweep(), 5 * 60 * 1000)
if (typeof cleanupInterval.unref === 'function') cleanupInterval.unref()

function sweep(): void {
  const now = Date.now()
  for (const [id, s] of store) {
    if (s.expiresAt <= now) store.delete(id)
  }
}

export function createSession(input: {
  branchId: number
  changes: PriceChange[]
  costChanges: CostChange[]
  createdBy: number
  fileName?: string | null
}): PriceImportSession {
  sweep()
  const id = randomBytes(16).toString('hex')
  const now = Date.now()
  const session: PriceImportSession = {
    id,
    branchId: input.branchId,
    changes: input.changes,
    costChanges: input.costChanges,
    createdAt: now,
    expiresAt: now + TTL_MS,
    createdBy: input.createdBy,
    fileName: input.fileName ?? null,
  }
  store.set(id, session)
  return session
}

export function getSession(id: string): PriceImportSession | null {
  const s = store.get(id)
  if (!s) return null
  if (s.expiresAt <= Date.now()) {
    store.delete(id)
    return null
  }
  return s
}

export function deleteSession(id: string): void {
  store.delete(id)
}
