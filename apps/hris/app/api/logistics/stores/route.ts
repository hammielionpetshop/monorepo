import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { saveStore } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  action: z.literal('save_store'),
  customerId: z.number().int().positive(),
  defaultRouteId: z.number().int().positive().nullable(),
  deliveryNote: z.string().max(2000).nullable(),
});

// Data Toko (spec LT1 §12): simpan rute bawaan + catatan pengiriman. Hak diperiksa di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const result = await saveStore(actor, parsed.data);
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
