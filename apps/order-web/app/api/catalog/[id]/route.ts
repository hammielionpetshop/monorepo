import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/require-customer';
import { getCatalogDetail } from '@/lib/services/catalog-service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 });
  }

  try {
    const detail = await getCatalogDetail(productId, gate.tierType);
    if (!detail) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error('catalog detail error:', error);
    return NextResponse.json({ error: 'Gagal memuat detail produk' }, { status: 500 });
  }
}
