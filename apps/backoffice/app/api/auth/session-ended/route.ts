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
 *
 * Kenapa header `Location` RELATIF dan bukan `NextResponse.redirect(new URL(..., req.url))`:
 * di produksi backoffice jalan sebagai Next standalone di Docker dengan `HOSTNAME=0.0.0.0`,
 * jadi `req.url` origin-nya `http://0.0.0.0:3000` (host bind server, bukan domain publik yang
 * diteruskan Caddy). URL absolut dari situ membuat browser device lama loncat ke `0.0.0.0`
 * lalu blank. `Location` relatif diselesaikan browser terhadap URL asli di bilah alamat,
 * jadi tetap di domain yang benar tanpa harus mempercayai header `X-Forwarded-Host`.
 */
export async function GET(req: NextRequest) {
  const isPos = req.nextUrl.searchParams.get('from') === 'pos';
  const location = `${isPos ? '/pos/login' : '/login'}?reason=taken_over`;

  const response = new NextResponse(null, { status: 307, headers: { Location: location } });
  response.cookies.delete('accessToken');
  return response;
}
