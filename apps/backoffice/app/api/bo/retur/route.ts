import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/authz';
import { ReturService, type ReturnStatusFilter } from '@/lib/services/retur-service';

export const dynamic = 'force-dynamic';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_VALUES: ReturnStatusFilter[] = ['', 'ACTIVE', 'CANCELLED'];

export async function GET(req: NextRequest) {
  const payload = await getAuth();
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const q = searchParams.get('q')?.trim() ?? '';
    const status = (searchParams.get('status') ?? '') as ReturnStatusFilter;
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';

    if (!STATUS_VALUES.includes(status)) {
      return NextResponse.json({ error: 'Status retur tidak valid' }, { status: 400 });
    }
    if (dateFrom && !ISO_DATE_RE.test(dateFrom)) {
      return NextResponse.json({ error: 'Format dateFrom tidak valid (gunakan YYYY-MM-DD)' }, { status: 400 });
    }
    if (dateTo && !ISO_DATE_RE.test(dateTo)) {
      return NextResponse.json({ error: 'Format dateTo tidak valid (gunakan YYYY-MM-DD)' }, { status: 400 });
    }

    // Sumbu SCOPE: hanya `branchScope === 'ALL'` yang boleh memilih cabang lain,
    // selain itu selalu dipaksa ke cabang aktif user.
    const isPrivileged = payload.branchScope === 'ALL';
    const branchIdParam = searchParams.get('branchId') ?? '';
    const branchId = isPrivileged
      ? (branchIdParam ? parseInt(branchIdParam, 10) || null : null)
      : payload.branchId;

    const result = await ReturService.listReturns({
      branchId,
      q,
      status,
      dateFrom,
      dateTo,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[retur] GET error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil riwayat retur' }, { status: 500 });
  }
}

const returSchema = z.object({
  transactionId: z.number().int().positive(),
  reason: z.string().min(1, 'Alasan retur wajib diisi'),
  items: z.array(z.object({
    transactionItemId: z.number().int().positive(),
    qty: z.string().regex(/^\d+(\.\d+)?$/, 'Kuantitas tidak valid'),
  })).min(1, 'Pilih minimal 1 item untuk diretur'),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await getAuth();

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    const { userId, branchId } = payload;
    const body = await req.json();
    
    const parsed = returSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const result = await ReturService.processRetur({
      ...parsed.data,
      branchId,
      processedById: userId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memproses retur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
