import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { forceCloseShift, ShiftNotOpenError } from '@/lib/services/shift-force-close';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const { id } = await params;
    const shiftId = parseInt(id);
    const body = await req.json();
    const { reason } = body;
    const forceClosedById = body.forceClosedById || payload.userId;

    if (!reason) {
      return NextResponse.json({ error: 'Alasan tutup paksa wajib diisi' }, { status: 400 });
    }

    const updatedShift = await forceCloseShift(shiftId, { forceClosedById, reason });

    return NextResponse.json(updatedShift);
  } catch (error: any) {
    if (error instanceof ShiftNotOpenError) {
      return NextResponse.json({ error: 'Shift tidak ditemukan atau sudah ditutup' }, { status: 404 });
    }
    console.error('Force close shift API error:', error);
    return NextResponse.json({ error: 'Gagal menutup paksa shift' }, { status: 500 });
  }
}
