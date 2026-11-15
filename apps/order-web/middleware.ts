import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCustomerToken } from './lib/customer-auth';

// Path publik (tanpa proteksi auth customer): OTP request/verify, halaman login, aset Next.
const PUBLIC_PREFIXES = ['/api/auth', '/api/health', '/_next'];
const PUBLIC_EXACT = new Set(['/favicon.ico', '/login']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('customerToken')?.value;
  const payload = token ? await verifyCustomerToken(token) : null;

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
