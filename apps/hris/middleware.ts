import { NextResponse, type NextRequest } from 'next/server';
import { legacyPathTarget } from './lib/legacy-paths';

/**
 * `x-hris-path`: alamat permintaan untuk penjaga akses terbatas mantan karyawan (spec L4g §3.7). Selalu ditimpa di sini,
 * jadi nilai kiriman browser tidak pernah dipakai.
 * `x-hris-return` (hanya `/clock-in`): QR cetakan membuka `/clock-in?c=<kode>`; kerangka aplikasi tidak tahu alamatnya, jadi
 * alamat ini diteruskan supaya sesudah login orang kembali ke absen dengan kodenya (spec L3b §4).
 */
/** Alamat lengkap tujuan pengalihan memakai host publik (Caddy meneruskan Host/X-Forwarded-*). */
function absoluteTarget(req: NextRequest, path: string): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}${path}${req.nextUrl.search}`;
}

export function middleware(req: NextRequest) {
  // Alamat lama berbahasa Indonesia (tautan tersimpan, QR cetak, bookmark) → alamat baru.
  const legacy = legacyPathTarget(req.nextUrl.pathname);
  if (legacy) return NextResponse.redirect(absoluteTarget(req, legacy), 308);
  const headers = new Headers(req.headers);
  headers.set('x-hris-path', req.nextUrl.pathname);
  // Dipakai pengalihan HRIS ↔ Logistik (spec F2-7b §3) supaya alamat lengkap ikut pindah.
  headers.set('x-hris-search', req.nextUrl.search);
  if (req.nextUrl.pathname === '/clock-in') headers.set('x-hris-return', `${req.nextUrl.pathname}${req.nextUrl.search}`);
  else headers.delete('x-hris-return');
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
