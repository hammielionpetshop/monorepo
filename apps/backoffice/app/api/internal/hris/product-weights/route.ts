import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authorizeInternalPermission } from '@/lib/internal-gate';
import { applyWeights, UnloadingSyncError } from '@/lib/services/po-unloading';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive();
const bodySchema = z.object({ productId: id, uomId: id, gram: z.number().int().positive(), expectedGram: z.number().int().positive().nullable() });

// Pintu internal HRIS: ubah berat per satuan dari layar Berat bongkaran. Berat satu sumber = POS (spec 2026-11-06).
export async function POST(req: NextRequest) {
  const actor = await authorizeInternalPermission(req, 'po.unloading_sync', 'Akun kasir Anda tidak berhak mengubah berat produk.');
  if (actor instanceof NextResponse) return actor;
  if (!req.headers.get('idempotency-key')) return NextResponse.json({ error: 'Header Idempotency-Key wajib.' }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  try {
    // Kiriman ulang dengan berat sama lolos tanpa perubahan (applyWeights melewati nilai yang sudah sama).
    await db.transaction((tx) => applyWeights(tx, [parsed.data]));
    return NextResponse.json({ ok: true, gram: parsed.data.gram });
  } catch (error) {
    if (error instanceof UnloadingSyncError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Ubah berat dari HRIS gagal:', error);
    return NextResponse.json({ error: 'Gagal mengubah berat produk.' }, { status: 500 });
  }
}
