import { NextResponse } from 'next/server';
import { isCentralMode } from '@/lib/central-cookie-name';

/** Token CSRF untuk web gateway (spec F2-7a §2a). Hanya ada pada mode central. */
export async function GET() {
  if (!isCentralMode()) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
  const { issueCsrf, setCsrfNonceCookie } = await import('@/lib/central-auth');
  const { token, nonce } = await issueCsrf();
  const response = NextResponse.json({ token });
  response.headers.set('Cache-Control', 'no-store');
  if (nonce) setCsrfNonceCookie(response, nonce);
  return response;
}
