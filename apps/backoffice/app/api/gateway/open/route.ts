import { NextResponse } from 'next/server';
import { isCentralMode } from '@/lib/central-cookie-name';

/** Buka akses web tujuan dari sesi yang sama lalu beri alamatnya (spec F2-7a §2a, §4). */
export async function POST(req: Request) {
  if (!isCentralMode()) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 });
  const [central, { openWeb }, { isWebCode }] = await Promise.all([
    import('@/lib/central-auth'),
    import('@/lib/services/gateway-service'),
    import('@/lib/web-access'),
  ]);
  const denied = await central.checkMutation(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!isWebCode(body?.web)) return NextResponse.json({ error: 'Web tidak dikenal' }, { status: 400 });
  const token = await central.readCentralToken();
  if (!token) return NextResponse.json({ error: 'Belum masuk' }, { status: 401 });
  const result = await openWeb(token, body.web);
  return result.ok
    ? NextResponse.json({ url: result.url })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
