import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, deviceLabel, setSessionCookie } from '@/lib/auth';
import { finishRecoveryWithTicket } from '@/modules/accounts';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ ticket: z.string().max(100), newPassword: z.string().max(1024) });

// KAR-L04 langkah 2, tanpa sesi: password baru lalu langsung masuk.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await finishRecoveryWithTicket({ ...parsed.data, deviceLabel: deviceLabel(req) });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, result.token);
  return response;
}
