import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db, users, eq } from '@/lib/db';
import { onboardingSchema } from '@petshop/shared';
import * as argon2 from 'argon2';
import { signAccessToken, verifyAccessToken } from '@/lib/auth';
import { getDefaultCredentials } from '@/lib/app-settings';

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
    }
    const { newPassword, newPin } = parsed.data;

    // Tolak nilai == default: onboarding wajib benar-benar mengganti kredensial,
    // bukan sekadar mengetik ulang default yang dibagikan OWNER.
    const { password: defaultPassword, pin: defaultPin } = await getDefaultCredentials();
    if (newPassword === defaultPassword) {
      return NextResponse.json({ error: 'Password baru tidak boleh sama dengan password default' }, { status: 400 });
    }
    if (newPin === defaultPin) {
      return NextResponse.json({ error: 'PIN baru tidak boleh sama dengan PIN default' }, { status: 400 });
    }

    const passwordHash = await argon2.hash(newPassword);
    const pinHash = await argon2.hash(newPin);

    await db
      .update(users)
      .set({
        passwordHash,
        pinHash,
        mustChangeCredentials: false,
        credentialsSetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.userId));

    // Re-issue accessToken dengan mustChangeCredentials=false agar gerbang onboarding
    // di middleware langsung terbuka tanpa harus login ulang. Buang iat/exp lama.
    const { iat: _iat, exp: _exp, ...rest } = payload;
    const newToken = await signAccessToken({ ...rest, mustChangeCredentials: false });

    const response = NextResponse.json({ ok: true, role: payload.role });
    response.cookies.set('accessToken', newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
