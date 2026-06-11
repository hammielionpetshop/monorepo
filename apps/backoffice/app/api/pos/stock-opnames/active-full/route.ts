import { NextRequest, NextResponse } from 'next/server';
import { db, stockOpnames, eq, and } from '@/lib/db';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { getPosBranchId } from '@/lib/pos-branch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    new URL(req.url);
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const branchId = getPosBranchId(payload, cookieStore);

    const results = await db.select()
      .from(stockOpnames)
      .where(and(
        eq(stockOpnames.branchId, branchId),
        eq(stockOpnames.type, 'FULL'),
        eq(stockOpnames.status, 'PENDING'),
        eq(stockOpnames.isSkipped, false)
      ));

    return NextResponse.json(results);

  } catch (error: unknown) {
    console.error('Get Active FULL SO API error:', error);
    return NextResponse.json({ error: 'Gagal mengambil stock opname aktif' }, { status: 500 });
  }
}
