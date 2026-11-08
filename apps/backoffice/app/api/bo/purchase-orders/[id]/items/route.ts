import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/authz';
import { db } from '@/lib/db';
import { serviceProductMessage } from '@/lib/service-product-guard';
import { editPoItems, PoItemEditError } from '@/lib/services/po-item-edit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    uomId: z.number().int().positive(),
    qtyOrdered: z.number().int().positive('Jumlah harus lebih dari 0'),
    unitCost: z.number().int().nonnegative('Harga tidak boleh minus'),
  })).min(1, 'PO minimal berisi satu barang'),
});

/**
 * Ubah isi PO (tambah/hapus barang, jumlah, harga) selama penerimaan belum disetujui.
 * Draft bongkaran: pemegang po.manage (keputusan owner 2026-11-06 butir 4). Status lain: hanya
 * OWNER/GM; PO yang sudah disetujui kembali ke Menunggu Persetujuan (spec 2026-11-06-po-edit-items).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('po.manage');
  if (gate instanceof NextResponse) return gate;
  const payload = gate;
  const poId = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(poId) || poId <= 0) return NextResponse.json({ error: 'ID Purchase Order tidak valid' }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
  const { items } = parsed.data;
  const serviceMessage = await serviceProductMessage(items.map((i) => i.productId));
  if (serviceMessage) return NextResponse.json({ error: serviceMessage }, { status: 400 });

  try {
    const result = await db.transaction((tx) => editPoItems(tx, {
      poId,
      items,
      actor: { userId: payload.userId, role: payload.role ?? '', branchScope: payload.branchScope ?? 'OWN', branchId: payload.branchId },
    }));
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PoItemEditError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Ubah isi PO gagal:', error);
    return NextResponse.json({ error: 'Gagal mengubah isi PO' }, { status: 500 });
  }
}
