import { NextResponse } from 'next/server';
import { db, users, eq, or, and, roles } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = parseInt(searchParams.get('branchId') || '1');

    // Kasir dan Manager difilter per cabang (branchId di record mereka).
    // Owner tidak terikat cabang — ditampilkan untuk semua cabang.
    const result = await db
      .select({
        id: users.id,
        name: users.name,
        role: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(users.isActive, true),
          or(
            and(
              eq(users.branchId, branchId),
              or(
                eq(roles.name, 'KASIR'),
                eq(roles.name, 'MANAGER')
              )
            ),
            eq(roles.name, 'OWNER')
          )
        )
      );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Users list API error:', error);
    return NextResponse.json({ error: 'Gagal mengambil data pengguna' }, { status: 500 });
  }
}
