import { NextResponse, type NextRequest } from 'next/server';

/**
 * Pendaratan bagi sesi yang sudah dicabut: bersihkan cookie, lalu antar ke login dengan
 * alasannya terbawa.
 *
 * Kenapa perlu route handler tersendiri dan bukan `redirect('/login')` langsung dari layout:
 * `middleware.ts` berjalan di Edge dan hanya bisa memverifikasi TANDA TANGAN token. Token milik
 * sesi yang dicabut tanda tangannya masih sah, jadi middleware menganggap orangnya masih login
 * dan memantulkannya dari `/login` kembali ke aplikasi — sementara aplikasi memantulkannya lagi
 * ke `/login`. Lingkaran itu hanya putus kalau cookie-nya benar-benar hilang, dan hanya route
 * handler (bukan server component) yang boleh menghapus cookie.
 */
export async function GET(req: NextRequest) {
  const isPos = req.nextUrl.searchParams.get('from') === 'pos';
  const target = new URL(isPos ? '/pos/login' : '/login', req.url);
  target.searchParams.set('reason', 'taken_over');

  const response = NextResponse.redirect(target);
  response.cookies.delete('accessToken');
  return response;
}
