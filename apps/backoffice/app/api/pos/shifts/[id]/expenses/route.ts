import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { db, shiftExpenses, shifts, expenseCategories, users, eq, and, desc } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_AMOUNT = 2147483647;

export async function GET(
  _req: Request,
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
    if (Number.isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID shift tidak valid' }, { status: 400 });
    }

    const [shift] = await db
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .limit(1);
    if (!shift) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 });
    }

    const expenses = await db
      .select({
        id: shiftExpenses.id,
        shiftId: shiftExpenses.shiftId,
        cashierId: shiftExpenses.cashierId,
        cashierName: users.name,
        categoryId: shiftExpenses.categoryId,
        categoryName: expenseCategories.name,
        categoryCustom: shiftExpenses.categoryCustom,
        amount: shiftExpenses.amount,
        note: shiftExpenses.note,
        proofImage: shiftExpenses.proofImage,
        createdAt: shiftExpenses.createdAt,
      })
      .from(shiftExpenses)
      .leftJoin(users, eq(shiftExpenses.cashierId, users.id))
      .leftJoin(expenseCategories, eq(shiftExpenses.categoryId, expenseCategories.id))
      .where(eq(shiftExpenses.shiftId, shiftId))
      .orderBy(desc(shiftExpenses.createdAt));

    const data = expenses.map((e) => ({ ...e, amount: Number(e.amount) }));

    return NextResponse.json({
      data,
      shiftStatus: shift.status,
      totalAmount: data.reduce((sum, e) => sum + e.amount, 0),
      currentUserId: payload.userId,
      canManage: payload.permissions.includes('shift_expense.manage'),
    });
  } catch (error: unknown) {
    console.error('List expenses API error:', error);
    return NextResponse.json({ error: 'Gagal mengambil daftar pengeluaran' }, { status: 500 });
  }
}

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
    if (Number.isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID shift tidak valid' }, { status: 400 });
    }

    const body = await req.json();
    const { categoryId, categoryCustom, note, proofImage } = body;
    // Kasir hanya boleh mencatat atas namanya sendiri; cashierId dari body diabaikan
    // supaya pengeluaran tidak bisa ditempelkan ke kasir lain.
    const cashierId = payload.userId;

    if ((!categoryId && !categoryCustom) || !note) {
      return NextResponse.json({ error: 'Keterangan wajib diisi' }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 });
    }
    if (amount > MAX_AMOUNT) {
      return NextResponse.json({ error: 'Jumlah pengeluaran melebihi batas maksimum yang diperbolehkan' }, { status: 400 });
    }

    const [shift] = await db
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'OPEN')))
      .limit(1);
    if (!shift) {
      return NextResponse.json({ error: 'Shift tidak ditemukan atau sudah ditutup' }, { status: 409 });
    }

    const [newExpense] = await db
      .insert(shiftExpenses)
      .values({
        shiftId,
        cashierId,
        categoryId: categoryId ?? null,
        categoryCustom: categoryCustom ?? null,
        amount,
        note,
        proofImage: proofImage ?? null,
      })
      .returning();

    return NextResponse.json({ ...newExpense, amount: Number(newExpense.amount) }, { status: 201 });
  } catch (error: unknown) {
    console.error('Add expense API error:', error);
    return NextResponse.json({ error: 'Gagal mencatat pengeluaran' }, { status: 500 });
  }
}
