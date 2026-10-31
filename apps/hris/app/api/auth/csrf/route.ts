import { NextResponse } from 'next/server';
import { issueCsrf, setCsrfNonceCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { token, nonce } = await issueCsrf();
  const response = NextResponse.json({ token });
  response.headers.set('Cache-Control', 'no-store');
  if (nonce) setCsrfNonceCookie(response, nonce);
  return response;
}
