import { NextResponse } from 'next/server';
import { verifyOtpSchema } from '@petshop/shared';
import { verifyOtp } from '@/lib/services/otp-service';

const CUSTOMER_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
    }

    const result = await verifyOtp(parsed.data.phone, parsed.data.code);
    if (!result.ok) {
      const status = result.reason === 'INVALID_PHONE' ? 400 : result.reason === 'NOT_WHITELISTED' ? 403 : 401;
      return NextResponse.json({ error: result.error }, { status });
    }

    const response = NextResponse.json({ message: 'Login berhasil' });
    response.cookies.set('customerToken', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CUSTOMER_TOKEN_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error('verify-otp error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
