import { auditEvents } from '@petshop/hris-db/schema/access';
import type { db } from '@/lib/db';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AuditInput = {
  actorAccountId: number;
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
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  });
}
