import { NextResponse, type NextRequest } from 'next/server';
import { legacyPathTarget } from './lib/legacy-paths';

/** Alamat lengkap tujuan pengalihan memakai host publik (Caddy meneruskan Host/X-Forwarded-*). */
function absoluteTarget(req: NextRequest, path: string): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}${path}${req.nextUrl.search}`;
}

/** Alamat lama berbahasa Indonesia → alamat baru (spec `docs/work/specs/2026-11-14-english-routes-design.md`). */
export function middleware(req: NextRequest) {
  const legacy = legacyPathTarget(req.nextUrl.pathname);
  if (legacy) return NextResponse.redirect(absoluteTarget(req, legacy), 308);
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'] };
