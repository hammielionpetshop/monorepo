import { NextResponse } from 'next/server';
import { db, shiftExpenses, expenseCategories, users, eq, and, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shiftId = parseInt(id);

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
      .where(eq(shiftExpenses.shiftId, shiftId));

    return NextResponse.json(expenses);
  } catch (error: any) {
    console.error('List expenses API error:', error);
    return NextResponse.json({ error: 'Failed to list expenses' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shiftId = parseInt(id);
    const body = await req.json();
    const { cashierId, categoryId, categoryCustom, amount, note, proofImage } = body;

    if (!cashierId || (!categoryId && !categoryCustom) || !amount || !note) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [newExpense] = await db
      .insert(shiftExpenses)
      .values({
        shiftId,
        cashierId,
        categoryId,
        categoryCustom,
        amount: amount.toString(),
        note,
        proofImage,
      })
      .returning();

    return NextResponse.json(newExpense);
  } catch (error: any) {
    console.error('Add expense API error:', error);
    return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 });
  }
}
