import { NextResponse, type NextRequest } from 'next/server';
import { legacyPathTarget } from './lib/legacy-paths';

/** Alamat lama berbahasa Indonesia → alamat baru (spec `docs/work/specs/2026-11-14-english-routes-design.md`). */
export function middleware(req: NextRequest) {
  const legacy = legacyPathTarget(req.nextUrl.pathname);
  if (legacy) return new NextResponse(null, { status: 308, headers: { Location: `${legacy}${req.nextUrl.search}` } });
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'] };
