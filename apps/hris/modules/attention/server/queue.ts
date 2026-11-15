import { and, eq, lt, sql } from 'drizzle-orm';
import { queueShown } from '@petshop/hris-db/schema/attention';
import { db } from '@/lib/db';
import { isLogisticsPath, type HrisWeb, type WebOrigins } from '@/lib/web-split';
import type { Actor } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import { buildQueue, isQueueKind, type QueueItem } from '../rules/queue';
import { attentionCards } from './cards';

/** Jenis yang sudah di-OK akun ini pada hari WIB itu. */
export async function shownKinds(accountId: number, on: string): Promise<Set<string>> {
  const rows = await db.select({ kind: queueShown.kind }).from(queueShown)
    .where(and(eq(queueShown.accountId, accountId), eq(queueShown.shownOn, on)));
  return new Set(rows.map((row) => row.kind));
}

/**
 * GET /api/queue (spec F3-1 §3.4): jendela untuk akun yang masuk, sudah berurutan. Akses terbatas mantan
 * karyawan tidak mendapat antrean. Jendela tampil di web HRIS maupun Logistik (keputusan §9 butir 2);
 * tautan ke layar milik web lain diberi alamat lengkap web itu.
 */
export async function listQueue(accountId: number, actor: Actor | null, web: HrisWeb, origins: WebOrigins): Promise<QueueItem[]> {
  if (!actor || actor.limited) return [];
  const [{ mine, system }, shown] = await Promise.all([attentionCards(actor), shownKinds(accountId, todayWib())]);
  return buildQueue([...system, ...mine], shown).map((item) => ({ ...item, href: hrefForWeb(item.href, web, origins) }));
}

export function hrefForWeb(href: string, web: HrisWeb, origins: WebOrigins): string {
  if (!origins.logistics) return href;
  const owner: HrisWeb = isLogisticsPath(href) ? 'logistik' : 'hris';
  if (owner === web) return href;
  const origin = owner === 'logistik' ? origins.logistics : origins.hris;
  return origin ? `${origin}${href}` : href;
}

/**
 * POST /api/queue/ack: catat "sudah tampil hari ini". Diulang tetap satu baris. Sekalian membuang catatan
 * akun itu yang lebih dari 90 hari (sama dengan masa simpan lonceng).
 */
export async function acknowledgeQueue(accountId: number, kind: string): Promise<boolean> {
  if (!isQueueKind(kind)) return false;
  await db.insert(queueShown).values({ accountId, kind, shownOn: todayWib() }).onConflictDoNothing();
  await db.delete(queueShown).where(and(eq(queueShown.accountId, accountId), lt(queueShown.shownOn, sql`(current_date - interval '90 days')::date`)));
  return true;
}
