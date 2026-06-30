import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessToken } from './lib/auth';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3001',
];

// Path publik (tanpa proteksi auth).
// Aset PWA wajib publik: browser mem-fetch manifest TANPA cookie, sehingga bila
// diproteksi akan di-redirect ke /login (HTML) → "Manifest syntax error". Begitu
// juga service worker, halaman offline, & icon harus dapat diakses tanpa auth.
const PUBLIC_PREFIXES = ['/api/auth', '/api/health', '/_next', '/icon'];
const PUBLIC_EXACT = new Set(['/favicon.ico', '/manifest.webmanifest', '/sw.js', '/offline']);

const BO_PATH_PREFIXES = ['/dashboard', '/bo', '/master-data', '/settings', '/reports', '/inventory', '/retur', '/audit-log', '/purchase-orders'];
const POS_ALLOWED_ROLES = ['KASIR', 'OWNER', 'GM', 'MANAGER'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = allowedOrigins.includes(origin) || origin === '';

  const withCors = (response: NextResponse) => {
    if (isAllowedOrigin && origin) response.headers.set('Access-Control-Allow-Origin', origin);
    return response;
  };

  // Tolak akses tanpa autentikasi: API → 401, halaman → redirect ke login terkait.
  const rejectUnauthenticated = () => {
    if (pathname.startsWith('/api/')) {
      return withCors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
    }
    const loginPath = pathname.startsWith('/pos') ? '/pos/login' : '/login';
    return NextResponse.redirect(new URL(loginPath, request.url));
  };

  // Preflight CORS
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

  // Path publik (termasuk aset PWA)
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return withCors(NextResponse.next());
  }

  // Halaman login: user yang sudah login dialihkan ke tujuan sesuai role.
  if (pathname === '/login' || pathname === '/pos/login') {
    const token = request.cookies.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (payload) {
      if (payload.role === 'KASIR') return NextResponse.redirect(new URL('/pos', request.url));
      if (['OWNER', 'GM', 'MANAGER'].includes(payload.role)) return NextResponse.redirect(new URL('/pos/select-branch', request.url));
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return withCors(NextResponse.next());
  }

  // Route terproteksi
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : request.cookies.get('accessToken')?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  if (!payload) {
    return rejectUnauthenticated();
  }

  // Role guard: KASIR mencoba akses backoffice → /pos
  if (payload.role === 'KASIR' && BO_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // Role guard: role tidak diizinkan akses POS UI → /dashboard
  if (!POS_ALLOWED_ROLES.includes(payload.role) && pathname.startsWith('/pos') && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return withCors(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
