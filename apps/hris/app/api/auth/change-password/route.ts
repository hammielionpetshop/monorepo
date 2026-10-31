import { NextResponse } from 'next/server';
import { z } from 'zod';
import { changePassword, openAppAccess } from '@petshop/auth';
import { checkMutation, clearSessionCookie, getAuthSql, readSessionToken, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter.').max(1024),
});

export async function POST(req: Request) {
  const rejected = await checkMutation(req);
  if (rejected) return NextResponse.json({ error: rejected }, { status: 403 });
  const token = await readSessionToken();
  if (!token) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali.' }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid.' }, { status: 400 });

  const sql = getAuthSql();
  const changed = await changePassword(sql, { token, ...parsed.data, revokeOtherSessions: true });
  if (!changed.ok) return NextResponse.json({ error: changed.error, code: changed.code }, { status: 400 });

  // Token dirotasi; buka akses HRIS dengan token baru. Tanpa tautan → ditolak jelas.
  const access = await openAppAccess(sql, changed.token, 'hris');
  if (!access.ok) {
    const response = NextResponse.json({ error: access.error, code: access.code }, { status: access.code === 'APP_ACCESS_DENIED' ? 403 : 400 });
    clearSessionCookie(response);
    return response;
  }
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, changed.token);
  return response;
}
