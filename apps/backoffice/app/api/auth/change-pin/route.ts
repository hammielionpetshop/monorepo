import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db, users, eq } from '@/lib/db';
import { changePinSchema } from '@petshop/shared';
import * as argon2 from 'argon2';
import { signAccessToken, verifyAccessToken } from '@/lib/auth';
import { getDefaultCredentials } from '@/lib/app-settings';

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24;

// Ganti PIN sendiri. Hidup di bawah /api/auth agar tetap bisa dipanggil saat user
// terkurung gerbang `mustChangePin` di middleware — sama seperti onboarding.
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 });
    }

    const parsed = changePinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
    }
    const { currentCredential, credentialType, newPin } = parsed.data;

    const [user] = await db
      .select({
        id: users.id,
        pinHash: users.pinHash,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Akun tidak ditemukan atau sudah nonaktif' }, { status: 401 });
    }

    // Verifikasi identitas sebelum mengganti PIN. User warisan tanpa `pin_hash` tidak punya
    // PIN lama untuk dicocokkan — arahkan memakai password, jangan lewatkan verifikasi.
    const currentHash = credentialType === 'pin' ? user.pinHash : user.passwordHash;
    if (!currentHash) {
      const message =
        credentialType === 'pin'
          ? 'Anda belum punya PIN. Gunakan password untuk verifikasi.'
          : 'Akun ini belum punya password. Gunakan PIN untuk verifikasi.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    let credentialValid = false;
    try {
      credentialValid = await argon2.verify(currentHash, currentCredential);
    } catch {
      credentialValid = false;
    }
    if (!credentialValid) {
      const message = credentialType === 'pin' ? 'PIN saat ini salah' : 'Password salah';
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // Tolak PIN default: nilainya disimpan plaintext dan dibagikan ke semua staf baru,
    // jadi memakainya sama saja dengan tidak punya PIN.
    const { pin: defaultPin } = await getDefaultCredentials();
    if (newPin === defaultPin) {
      return NextResponse.json({ error: 'PIN baru tidak boleh sama dengan PIN default' }, { status: 400 });
    }

    if (user.pinHash) {
      let samePin = false;
      try {
        samePin = await argon2.verify(user.pinHash, newPin);
      } catch {
        samePin = false;
      }
      if (samePin) {
        return NextResponse.json({ error: 'PIN baru tidak boleh sama dengan PIN lama' }, { status: 400 });
      }
    }

    await db
      .update(users)
      .set({
        pinHash: await argon2.hash(newPin),
        mustChangePin: false,
        pinSetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, payload.userId));

    // Re-issue accessToken tanpa `mustChangePin` agar gerbang di middleware langsung
    // terbuka tanpa login ulang. Buang iat/exp lama.
    const { iat: _iat, exp: _exp, ...rest } = payload;
    const newToken = await signAccessToken({ ...rest, mustChangePin: false });

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
    console.error('POST /api/auth/change-pin error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
