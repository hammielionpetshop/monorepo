import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as argon2 from 'argon2';
import { changePassword, openAppAccess } from '@petshop/auth';
import { onboardingSchema } from '@petshop/shared';
import { db, users, eq } from '@/lib/db';
import { signAccessToken, verifyAccessTokenSignatureOnly } from '@/lib/auth';
import { getDefaultCredentials } from '@/lib/app-settings';
import { backofficePolicy, checkMutation, getAuthSql, readCentralToken, setCentralCookie } from '@/lib/central-auth';

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24;
const MIN_CENTRAL_PASSWORD = 8;

/**
 * Onboarding mode central. Sesi onboarding pusat belum punya akses app (15 menit), jadi JWT
 * hanya diperiksa tanda tangannya dan kecocokannya dengan sesi pusat dilakukan oleh
 * `changePassword`, yang menuntut password lama dan memutar token.
 */
export async function centralOnboarding(req: Request): Promise<Response> {
  const denied = await checkMutation(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const cookieStore = await cookies();
  const jwt = cookieStore.get('accessToken')?.value;
  const payload = jwt ? await verifyAccessTokenSignatureOnly(jwt) : null;
  const centralToken = await readCentralToken();
  if (!payload || payload.centralSessionId === undefined || !centralToken) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  if (!parsed.success || !currentPassword) {
    return NextResponse.json({ error: parsed.success ? 'Password saat ini wajib diisi' : (parsed.error.issues[0]?.message ?? 'Data tidak valid') }, { status: 400 });
  }
  const { newPassword, newPin } = parsed.data;
  if (newPassword.length < MIN_CENTRAL_PASSWORD) {
    return NextResponse.json({ error: `Password baru minimal ${MIN_CENTRAL_PASSWORD} karakter` }, { status: 400 });
  }

  const { password: defaultPassword, pin: defaultPin } = await getDefaultCredentials();
  if (newPassword === defaultPassword) {
    return NextResponse.json({ error: 'Password baru tidak boleh sama dengan password default' }, { status: 400 });
  }
  if (newPin === defaultPin) {
    return NextResponse.json({ error: 'PIN baru tidak boleh sama dengan PIN default' }, { status: 400 });
  }

  const sql = getAuthSql();
  // Keputusan owner: ganti password wajib mencabut sesi perangkat lain.
  const changed = await changePassword(sql, { token: centralToken, currentPassword, newPassword, revokeOtherSessions: true });
  if (!changed.ok) return NextResponse.json({ error: changed.error }, { status: changed.code === 'INVALID_CREDENTIALS' ? 400 : 401 });

  const opened = await openAppAccess(sql, changed.token, 'backoffice', backofficePolicy(payload.role));
  if (!opened.ok || opened.localUserId !== payload.userId) {
    return NextResponse.json({ error: opened.ok ? 'Akun tidak sesuai dengan sesi' : opened.error }, { status: 403 });
  }

  // Selama fallback legacy masih ada, hash password di tabel lama disalin dari akun pusat
  // supaya kedua mode menerima password yang sama (spec L1c: konsistensi saat rollback).
  const [account] = await sql`select a.password_hash from auth.sessions s
    join auth.accounts a on a.id = s.account_id where s.id = ${opened.sessionId}`;
  try {
    await db
      .update(users)
      .set({
        passwordHash: account.password_hash,
        pinHash: await argon2.hash(newPin),
        mustChangeCredentials: false,
        credentialsSetAt: new Date(),
        mustChangePin: false,
        pinSetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.userId));
  } catch (error) {
    console.error('Onboarding central: sinkron tabel users gagal', error);
    return NextResponse.json({ error: 'Password pusat sudah diganti, tetapi sinkron data lama gagal. Hubungi Owner.' }, { status: 500 });
  }

  const { iat: _iat, exp: _exp, ...rest } = payload;
  const response = NextResponse.json({ ok: true, role: payload.role });
  response.cookies.set('accessToken', await signAccessToken({
    ...rest,
    centralSessionId: opened.sessionId,
    mustChangeCredentials: false,
    mustChangePin: false,
  }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: ACCESS_TOKEN_MAX_AGE });
  setCentralCookie(response, changed.token);
  return response;
}
