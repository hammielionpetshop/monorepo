import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/require-customer';
import { getCatalogFilters, getCatalogList } from '@/lib/services/catalog-service';

export const dynamic = 'force-dynamic';

function parsePositiveInteger(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(req: NextRequest) {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = parseInt(searchParams.get('limit') ?? '20', 10) || 20;

  try {
    const [list, filters] = await Promise.all([
      getCatalogList({
        tierType: gate.tierType,
        search: searchParams.get('search') ?? undefined,
        categoryId: parsePositiveInteger(searchParams.get('categoryId')),
        brandId: parsePositiveInteger(searchParams.get('brandId')),
        page,
        limit,
      }),
      page === 1 ? getCatalogFilters() : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...list, filters });
  } catch (error) {
    console.error('catalog list error:', error);
    return NextResponse.json({ error: 'Gagal memuat katalog' }, { status: 500 });
  }
}
