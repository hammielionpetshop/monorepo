import { NextResponse } from 'next/server';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import type { Actor } from '@/modules/access';

/**
 * Penjaga bersama pintu perubahan aturan (spec F3-3 §3.5): sesi + pemeriksaan asal untuk tulis. Hak tindakan
 * (`announcement.rule.*`) diperiksa di layanan modul announcements.
 */
export async function ruleActor(req: Request, mutation: boolean): Promise<{ ok: true; actor: Actor | null; accountId: number } | { ok: false; response: NextResponse }> {
  if (mutation) {
    const rejected = await checkMutation(req);
    if (rejected) return { ok: false, response: NextResponse.json({ error: rejected }, { status: 403 }) };
  }
  const session = await currentHrisSession();
  if (!session.ok) return { ok: false, response: NextResponse.json({ error: session.error, code: session.code }, { status: 401 }) };
  return { ok: true, actor: await actorForSession(session.accountId, session.localUserId), accountId: session.accountId };
}

export function respond<T>(result: { ok: true; value: T } | { ok: false; status: number; error: string }): NextResponse {
  return result.ok ? NextResponse.json(result.value ?? { ok: true }) : NextResponse.json({ error: result.error }, { status: result.status });
}

export function idOf(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
