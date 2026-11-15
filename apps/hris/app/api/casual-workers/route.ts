import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { actorForSession } from '@/lib/authz';
import { saveCasualWorker, setCasualWorkerActive } from '@/modules/employees';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('save'), id: id.nullable(), name: z.string().max(100), phone: z.string().max(30) }),
  z.object({ kind: z.literal('active'), id, active: z.boolean() }),
]);

// Pekerja Lepas (KAR-L28, spec L8 §9 butir 2). Hak diperiksa di layanan.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const actor = await actorForSession(session.accountId, session.localUserId);
  const body = parsed.data;
  const result = body.kind === 'save'
    ? await saveCasualWorker(actor, { id: body.id ?? undefined, name: body.name, phone: body.phone })
    : await setCasualWorkerActive(actor, body.id, body.active);
  return result.ok ? NextResponse.json({ ok: true, ...result.data }) : NextResponse.json({ error: result.error }, { status: result.status });
}
