import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { db, expenseCategories, asc } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Daftar Kategori Pengeluaran Kasir untuk dialog Catat Pengeluaran di POS. Daftarnya dikelola di Back Office
 * (Kategori Arus Kas › tab Pengeluaran Kasir) dan dipasangkan ke kategori Arus Kas agar terbaca di Laba Rugi.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
  }
  try {
    const data = await db
      .select({ id: expenseCategories.id, name: expenseCategories.name })
      .from(expenseCategories)
      .orderBy(asc(expenseCategories.name));
    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('List expense categories API error:', error);
    return NextResponse.json({ error: 'Gagal mengambil kategori pengeluaran' }, { status: 500 });
  }
}
