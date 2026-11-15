import { NextResponse } from 'next/server';
import { requestOtpSchema } from '@petshop/shared';
import { requestOtp } from '@/lib/services/otp-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = requestOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
    }

    const result = await requestOtp(parsed.data.phone);
    if (!result.ok) {
      const status = result.reason === 'INVALID_PHONE' ? 400 : result.reason === 'RATE_LIMITED' ? 429 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    const showDevOtp = (process.env.OTP_PROVIDER || 'console') === 'console';
    return NextResponse.json({
      message: 'Kode OTP dikirim jika nomor terdaftar',
      ...(showDevOtp && result.devOtp ? { devOtp: result.devOtp } : {}),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('request-otp error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
