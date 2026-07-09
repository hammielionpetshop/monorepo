import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuth } from '@/lib/authz';
import { ReturService } from '@/lib/services/retur-service';

export const dynamic = 'force-dynamic';

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
