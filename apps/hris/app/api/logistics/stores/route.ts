import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { decidePoint, pastePoint, saveStore } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_store'), customerId: id, defaultRouteId: id.nullable(), deliveryNote: z.string().max(2000).nullable() }),
  // Titik toko (spec LT1 §13.4): Setujui / Tolak usulan, tempel koordinat kantor.
  z.object({ action: z.literal('decide_point'), pointId: id, decision: z.enum(['APPROVE', 'REJECT']), reason: z.string().max(500) }),
  z.object({ action: z.literal('paste_point'), customerId: id, text: z.string().max(2000) }),
]);

// Data Toko (spec LT1 §12, §13.4): rute bawaan + catatan pengiriman, titik toko. Hak diperiksa di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const body = parsed.data;
  const result = body.action === 'save_store' ? await saveStore(actor, body)
    : body.action === 'decide_point' ? await decidePoint(actor, body.pointId, body.decision, body.reason)
      : await pastePoint(actor, body.customerId, body.text);
  return result.ok ? NextResponse.json({ ok: true, ...(result.data ?? {}) }) : NextResponse.json({ error: result.error }, { status: result.status });
}
