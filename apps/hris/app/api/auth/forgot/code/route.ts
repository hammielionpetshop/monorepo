import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkMutation, deviceLabel, setSessionCookie } from '@/lib/auth';
import { finishRecoveryWithCode } from '@/modules/accounts';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ identifier: z.string().min(1).max(255), code: z.string().max(10), newPassword: z.string().max(1024) });

// KAR-L05 Pakai kode dari GM, tanpa sesi: password baru lalu langsung masuk.
export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await finishRecoveryWithCode({ ...parsed.data, deviceLabel: deviceLabel(req) });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, result.token);
  return response;
}
