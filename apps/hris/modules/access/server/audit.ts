import { and, desc, eq, inArray } from 'drizzle-orm';
import { auditEvents } from '@petshop/hris-db/schema/access';
import { db } from '@/lib/db';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Pelaku orang (actorAccountId) atau mesin terjadwal (jobName, actorAccountId null) — spec L2e §2.2. */
export type AuditInput = {
  actorAccountId: number | null;
  jobName?: string;
  entity: string;
  entityId: number | null;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
};

/** Satu baris jejak perubahan, di transaksi yang sama dengan perubahannya. */
export async function recordAudit(tx: Tx, input: AuditInput) {
  await tx.insert(auditEvents).values({
    actorAccountId: input.actorAccountId,
    source: input.jobName ? 'JOB' : 'USER',
    jobName: input.jobName ?? null,
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  });
}

export type AuditRow = {
  entityId: number | null; action: string; actorAccountId: number | null; before: unknown; after: unknown; reason: string | null; at: string;
};

/** Jejak perubahan beberapa baris satu entitas, terbaru dulu (layar "Riwayat" di modul pemiliknya). */
export async function auditTrail(entity: string, entityIds: number[]): Promise<AuditRow[]> {
  if (entityIds.length === 0) return [];
  const rows = await db.select().from(auditEvents)
    .where(and(eq(auditEvents.entity, entity), inArray(auditEvents.entityId, entityIds)))
    .orderBy(desc(auditEvents.id));
  return rows.map((row) => ({
    entityId: row.entityId, action: row.action, actorAccountId: row.actorAccountId, before: row.before, after: row.after,
    reason: row.reason, at: row.createdAt.toISOString(),
  }));
}
