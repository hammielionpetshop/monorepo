import { NextResponse } from 'next/server';
import { logoutSession } from '@petshop/auth';
import { checkMutation, clearSessionCookie, getAuthSql, readSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const token = await readSessionToken();
  if (token) await logoutSession(getAuthSql(), token);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
