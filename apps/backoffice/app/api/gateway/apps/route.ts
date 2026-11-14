import { NextResponse } from 'next/server';
import { isCentralMode } from '@/lib/central-cookie-name';

/** Daftar web yang menjadi hak sesi ini (spec F2-7a §3), untuk gateway dan tombol Pindah web. */
export async function GET() {
  if (!isCentralMode()) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
  const [{ readCentralToken }, { loadGatewayView }, { webUrlsFromEnv }] = await Promise.all([
    import('@/lib/central-auth'),
    import('@/lib/services/gateway-service'),
    import('@/lib/web-access'),
  ]);
  const token = await readCentralToken();
  const view = token ? await loadGatewayView(token) : null;
  const response = view
    ? NextResponse.json({ ...view, changePasswordUrl: view.changePasswordAt ? webUrlsFromEnv()[view.changePasswordAt] ?? null : null })
    : NextResponse.json({ error: 'Belum masuk' }, { status: 401 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
