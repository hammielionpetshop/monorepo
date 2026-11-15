import { and, count, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { notifications } from '@petshop/hris-db/schema/notifications';
import { db } from '@/lib/db';
import type { Tx } from '@/modules/access';

export type NotificationInput = {
  kind: string;
  title: string;
  body?: string | null;
  /** Alamat layar urusannya, selalu diawali "/". */
  link?: string | null;
  entity?: string | null;
  entityId?: number | null;
};

/**
 * Kirim satu kabar ke beberapa akun, di transaksi kejadiannya (TAM-25 "Pemberitahuan").
 * Pelaku tidak diberi tahu tindakannya sendiri (PRI-43 butir 5); penerima kembar disatukan.
 */
export async function notify(tx: Tx, recipientAccountIds: number[], input: NotificationInput, actorAccountId: number | null) {
  const recipients = [...new Set(recipientAccountIds)].filter((id) => id > 0 && id !== actorAccountId);
  if (!recipients.length) return 0;
  await tx.insert(notifications).values(recipients.map((recipientAccountId) => ({
    recipientAccountId,
    kind: input.kind,
    title: input.title.slice(0, 200),
    body: input.body?.slice(0, 1000) ?? null,
    link: input.link ?? null,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
  })));
  return recipients.length;
}

export const NOTIFICATION_PAGE_SIZE = 30;

export type NotificationItem = {
  id: number; kind: string; title: string; body: string | null; link: string | null; createdAt: string; read: boolean;
};

const toItem = (row: typeof notifications.$inferSelect): NotificationItem => ({
  id: row.id, kind: row.kind, title: row.title, body: row.body, link: row.link,
  createdAt: row.createdAt.toISOString(), read: row.readAt != null,
});

/** BER-L02: terbaru di atas, per halaman. */
export async function listNotifications(accountId: number, page = 1) {
  const offset = (Math.max(1, page) - 1) * NOTIFICATION_PAGE_SIZE;
  const rows = await db.select().from(notifications).where(eq(notifications.recipientAccountId, accountId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(NOTIFICATION_PAGE_SIZE + 1).offset(offset);
  return { items: rows.slice(0, NOTIFICATION_PAGE_SIZE).map(toItem), hasMore: rows.length > NOTIFICATION_PAGE_SIZE, page: Math.max(1, page) };
}

export async function unreadCount(accountId: number): Promise<number> {
  const [row] = await db.select({ n: count() }).from(notifications)
    .where(and(eq(notifications.recipientAccountId, accountId), isNull(notifications.readAt)));
  return Number(row?.n ?? 0);
}

/** Kartu "Kabar terbaru" di Beranda: yang belum dibuka (PRI-43 butir 1). */
export async function latestUnread(accountId: number, limit = 3): Promise<NotificationItem[]> {
  const rows = await db.select().from(notifications)
    .where(and(eq(notifications.recipientAccountId, accountId), isNull(notifications.readAt)))
    .orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit);
  return rows.map(toItem);
}

/** Tandai terbaca milik akun itu sendiri; mengembalikan alamat tujuannya. */
export async function markRead(accountId: number, id: number): Promise<{ link: string | null } | null> {
  const [row] = await db.select().from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.recipientAccountId, accountId)));
  if (!row) return null;
  if (!row.readAt) await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id));
  return { link: row.link };
}

export async function markAllRead(accountId: number): Promise<number> {
  const rows = await db.update(notifications).set({ readAt: new Date() })
    .where(and(eq(notifications.recipientAccountId, accountId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}

/** Job harian `notifications-purge`: buang kabar lebih dari 90 hari (BER-L02). Trigger menolak yang lebih muda. */
export async function purgeOldNotifications() {
  const rows = await db.delete(notifications)
    .where(lt(notifications.createdAt, sql`now() - interval '90 days'`))
    .returning({ id: notifications.id });
  return { deleted: rows.length };
}
