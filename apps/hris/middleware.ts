import { NextResponse, type NextRequest } from 'next/server';

/**
 * QR cetakan membuka `/absen?c=<kode>`. Kerangka aplikasi tidak tahu alamatnya, jadi alamat ini diteruskan lewat
 * tajuk supaya sesudah login orang kembali ke absen dengan kodenya (spec L3b §4).
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set('x-hris-return', `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: '/absen' };
