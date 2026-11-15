import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { markAllRead, markRead } from '@/modules/notifications';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('read'), id: z.number().int().positive() }),
  z.object({ kind: z.literal('read_all') }),
]);

// BER-L02: tandai terbaca hanya milik akun itu sendiri.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  if (parsed.data.kind === 'read_all') return NextResponse.json({ marked: await markAllRead(session.accountId) });
  const result = await markRead(session.accountId, parsed.data.id);
  return result ? NextResponse.json(result) : NextResponse.json({ error: 'Pemberitahuan tidak ditemukan.' }, { status: 404 });
}
