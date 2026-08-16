import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/authz';
import { ReturService } from '@/lib/services/retur-service';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  const payload = await getAuth();
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
  }

  try {
    const { returnId } = await params;
    if (!returnId || !UUID_RE.test(returnId)) {
      return NextResponse.json({ error: 'ID retur tidak valid' }, { status: 400 });
    }

    const branchId = payload.branchScope === 'ALL' ? null : payload.branchId;
    const detail = await ReturService.getReturnDetail(returnId, branchId);

    if (!detail) {
      return NextResponse.json({ error: 'Retur tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error: unknown) {
    console.error('[retur] GET detail error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil detail retur' }, { status: 500 });
  }
}
