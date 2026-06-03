import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from './lib/auth';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3001',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = allowedOrigins.includes(origin) || origin === '';

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });

    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
  }

  // Public paths
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    const response = NextResponse.next();
    if (isAllowedOrigin && origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    return response;
  }

  // Redirect authenticated users trying to access login paths (AC 4 & 6)
  if (pathname === '/login' || pathname === '/pos/login') {
    const token = request.cookies.get('accessToken')?.value;
    if (token) {
      const payload = await verifyAccessToken(token);
      if (payload) {
        if (payload.role === 'KASIR') {
          return NextResponse.redirect(new URL('/pos', request.url));
        } else {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }
    }
    const response = NextResponse.next();
    if (isAllowedOrigin && origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    return response;
  }

  // PROTECTED ROUTES
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : request.cookies.get('accessToken')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (isAllowedOrigin && origin) response.headers.set('Access-Control-Allow-Origin', origin);
      return response;
    }
    // Unauthenticated request ke /pos/* → redirect ke /pos/login
    if (pathname.startsWith('/pos')) {
      return NextResponse.redirect(new URL('/pos/login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (isAllowedOrigin && origin) response.headers.set('Access-Control-Allow-Origin', origin);
      return response;
    }
    if (pathname.startsWith('/pos')) {
      return NextResponse.redirect(new URL('/pos/login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role guard: KASIR mencoba akses backoffice → redirect ke /pos
  const boPathPrefixes = ['/dashboard', '/bo', '/master-data', '/settings', '/reports', '/inventory', '/retur', '/audit-log', '/purchase-orders'];
  const isBoPath = boPathPrefixes.some((prefix) => pathname.startsWith(prefix));
  if (payload.role === 'KASIR' && isBoPath) {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // Role guard: non-KASIR mencoba akses POS UI → redirect ke /dashboard
  if (payload.role !== 'KASIR' && pathname.startsWith('/pos') && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const response = NextResponse.next();
  if (isAllowedOrigin && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
