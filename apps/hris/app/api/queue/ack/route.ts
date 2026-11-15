import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, currentHrisSession } from '@/lib/auth';
import { acknowledgeQueue } from '@/modules/attention';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ kind: z.string().min(1).max(100) });

// Tombol OK / Buka di jendela antrean (spec F3-1 §3.4): jenis itu tidak muncul lagi hari ini.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const session = await currentHrisSession();
  if (!session.ok) return NextResponse.json({ error: session.error, code: session.code }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  return (await acknowledgeQueue(session.accountId, parsed.data.kind))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Jenis pengingat tidak dikenal.' }, { status: 400 });
}
