import { NextResponse } from 'next/server';
import { z } from 'zod';
import { passwordLogin } from '@petshop/auth';
import { checkMutation, deviceLabel, getAuthSql, readSessionToken, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ identifier: z.string().min(1).max(255), password: z.string().min(1).max(1024) });
const STATUS: Record<string, number> = { APP_ACCESS_DENIED: 403, INVALID_CREDENTIALS: 401 };

export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Isi identifier dan password.' }, { status: 400 });

  const result = await passwordLogin(getAuthSql(), {
    appCode: 'hris', ...parsed.data, previousToken: await readSessionToken(), deviceLabel: deviceLabel(req),
  });
  if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: STATUS[result.code] ?? 400 });

  const response = NextResponse.json({ ok: true, mustChangePassword: result.mustChangePassword });
  setSessionCookie(response, result.token);
  return response;
}
