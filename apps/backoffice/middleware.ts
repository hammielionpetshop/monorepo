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
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
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
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      if (isAllowedOrigin && origin) response.headers.set('Access-Control-Allow-Origin', origin);
      return response;
    }
    return NextResponse.redirect(new URL('/login', request.url));
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
