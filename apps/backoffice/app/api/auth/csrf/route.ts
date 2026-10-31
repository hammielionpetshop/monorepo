import { NextResponse } from 'next/server';
import { isCentralMode } from '@/lib/central-cookie-name';

/**
 * Token CSRF untuk mutasi sesi mode central. Mode legacy tidak memakainya (token null),
 * sehingga halaman login boleh selalu memanggil ini tanpa membedakan mode.
 */
export async function GET() {
  if (!isCentralMode()) return NextResponse.json({ token: null });
  const { issueCsrf, setCsrfNonceCookie } = await import('@/lib/central-auth');
  const { token, nonce } = await issueCsrf();
  const response = NextResponse.json({ token });
  response.headers.set('Cache-Control', 'no-store');
  if (nonce) setCsrfNonceCookie(response, nonce);
  return response;
}
