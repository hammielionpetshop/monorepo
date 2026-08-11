import { NextResponse, type NextRequest } from 'next/server';
import { db, branches, shifts, eq, and, sql } from '@/lib/db';
import { signAccessToken } from '@/lib/auth';
import { getAuth } from '@/lib/authz';
import { isBranchAllowed } from '@/lib/active-branch';

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24;

/**
 * Pindah cabang aktif di backoffice.
 *
 * Cabang aktif backoffice tinggal di TOKEN, bukan cookie terpisah — `payload.branchId` memang
 * sudah berarti "cabang yang sedang dikerjakan" di seluruh kode BO. Karena itu berpindah =
 * menandatangani ulang token. Ongkosnya sekali per perpindahan, dan imbalannya: setiap pembaca
 * `branchId` ikut berpindah, termasuk 42 berkas yang memanggil `verifyAccessToken` sendiri
 * tanpa lewat `getAuth()`. Cookie terpisah hanya akan memindahkan sebagian layar.
 *
 * Yang TIDAK ikut berubah: `permissions`, `role`, dan `branchIds`. Berpindah cabang bukan
 * berganti wewenang — hanya berganti tempat.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getAuth();
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const branchId = Number(body?.branchId);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return NextResponse.json({ error: 'Cabang tidak valid' }, { status: 400 });
    }

    if (!isBranchAllowed(payload, branchId)) {
      return NextResponse.json(
        { error: 'Anda tidak ditugaskan di cabang tersebut' },
        { status: 403 },
      );
    }

    const [branch] = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.isActive, true)))
      .limit(1);

    if (!branch) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 });
    }

    if (branchId !== payload.branchId) {
      // Sama seperti di POS: satu shift tidak boleh berisi transaksi dua cabang. Backoffice
      // ikut menulis ke shift (bulk sale, pelunasan piutang tunai) lewat `resolveShiftId`,
      // jadi lubangnya sama persis kalau tidak dijaga.
      const [openShift] = await db
        .select({ id: shifts.id })
        .from(shifts)
        .where(
          and(
            eq(shifts.branchId, payload.branchId),
            eq(shifts.status, 'OPEN'),
            sql`(${shifts.openedById} = ${payload.userId} OR ${shifts.assignedCashiers} @> ${JSON.stringify([payload.userId])}::jsonb)`,
          ),
        )
        .limit(1);

      if (openShift) {
        return NextResponse.json(
          {
            error:
              'Masih ada shift terbuka atas nama Anda di cabang ini. Selesaikan settlement dulu sebelum pindah cabang.',
          },
          { status: 409 },
        );
      }
    }

    // Buang iat/exp lama supaya masa berlaku dihitung ulang dari sekarang.
    const { iat: _iat, exp: _exp, ...rest } = payload;
    const newToken = await signAccessToken({
      ...rest,
      branchId: branch.id,
      branchName: branch.name,
    });

    const response = NextResponse.json({ ok: true, branchId: branch.id, branchName: branch.name });
    response.cookies.set('accessToken', newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error('POST /api/auth/switch-branch error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
