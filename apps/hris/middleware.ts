import { NextResponse, type NextRequest } from 'next/server';

/**
 * `x-hris-path`: alamat permintaan untuk penjaga akses terbatas mantan karyawan (spec L4g §3.7). Selalu ditimpa di sini,
 * jadi nilai kiriman browser tidak pernah dipakai.
 * `x-hris-return` (hanya `/absen`): QR cetakan membuka `/absen?c=<kode>`; kerangka aplikasi tidak tahu alamatnya, jadi
 * alamat ini diteruskan supaya sesudah login orang kembali ke absen dengan kodenya (spec L3b §4).
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-hris-path', req.nextUrl.pathname);
  if (req.nextUrl.pathname === '/absen') headers.set('x-hris-return', `${req.nextUrl.pathname}${req.nextUrl.search}`);
  else headers.delete('x-hris-return');
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
