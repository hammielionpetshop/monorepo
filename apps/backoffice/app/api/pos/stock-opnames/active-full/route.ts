import { NextRequest, NextResponse } from 'next/server';
import { db, stockOpnames, eq, and, inArray } from '@/lib/db';
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
        // DRAFT = belum dihitung, PENDING = sudah ada hitungan tapi masih bisa dilanjutkan
        inArray(stockOpnames.status, ['DRAFT', 'PENDING']),
        eq(stockOpnames.isSkipped, false)
      ));

    // Kalau admin menugaskan SO ke petugas tertentu, jangan tampilkan ke petugas
    // lain di cabang yang sama — supaya hitungan tidak nyasar ke SO orang lain saat
    // ada beberapa SO Besar aktif berbarengan. assignedUserIds kosong = terbuka
    // untuk siapa saja; OWNER/GM/MANAGER selalu bisa melihat semuanya untuk pengawasan.
    const canSeeAllAssignments = ['OWNER', 'GM', 'MANAGER'].includes(payload.role);
    const currentUserId = Number(payload.userId);
    const visible = results.filter((so) => {
      const assigned = so.assignedUserIds as number[] | null;
      if (!assigned || assigned.length === 0) return true;
      if (canSeeAllAssignments) return true;
      return assigned.includes(currentUserId);
    });

    return NextResponse.json(visible);

  } catch (error: unknown) {
    console.error('Get Active FULL SO API error:', error);
    return NextResponse.json({ error: 'Gagal mengambil stock opname aktif' }, { status: 500 });
  }
}
