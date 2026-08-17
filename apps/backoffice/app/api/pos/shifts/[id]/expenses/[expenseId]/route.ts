import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { db, shiftExpenses, shifts, eq, and } from '@/lib/db';
import {
  MAX_AMOUNT,
  ShiftExpenseServiceError,
  deleteShiftExpense,
  updateShiftExpense,
} from '@/lib/services/shift-expense-service';
import type { JWTPayload } from '@petshop/shared';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; expenseId: string }>;
}

/**
 * Kasir hanya boleh mengurus pengeluarannya sendiri — koreksi salah ketik, bukan menyunting
 * catatan rekan sekasir. Atasan dengan `shift_expense.manage` boleh menyentuh semuanya.
 * Batas "shift harus masih OPEN" ditegakkan di service dan berlaku untuk keduanya.
 */
async function authorize(
  shiftIdRaw: string,
  expenseIdRaw: string,
): Promise<{ payload: JWTPayload; shiftId: number; expenseId: number } | NextResponse> {
  const token = (await cookies()).get('accessToken')?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
  }

  const shiftId = parseInt(shiftIdRaw, 10);
  const expenseId = parseInt(expenseIdRaw, 10);
  if (Number.isNaN(shiftId) || Number.isNaN(expenseId)) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
  }

  const [row] = await db
    .select({ cashierId: shiftExpenses.cashierId, branchId: shifts.branchId })
    .from(shiftExpenses)
    .innerJoin(shifts, eq(shiftExpenses.shiftId, shifts.id))
    .where(and(eq(shiftExpenses.id, expenseId), eq(shiftExpenses.shiftId, shiftId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 });
  }

  const isOwner = row.cashierId === payload.userId;
  const canManage = payload.permissions.includes('shift_expense.manage');
  if (!isOwner && !canManage) {
    return NextResponse.json(
      { error: 'Pengeluaran ini dicatat kasir lain — minta atasan untuk mengubahnya' },
      { status: 403 },
    );
  }

  return { payload, shiftId, expenseId };
}

function toErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ShiftExpenseServiceError)) return null;
  if (error.code === 'NOT_FOUND') {
    return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 });
  }
  if (error.code === 'OUT_OF_SCOPE') {
    return NextResponse.json({ error: 'Pengeluaran ini bukan milik cabang Anda' }, { status: 403 });
  }
  return NextResponse.json(
    { error: 'Shift sudah ditutup, pengeluaran tidak bisa diubah lagi' },
    { status: 409 },
  );
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id, expenseId: expenseIdRaw } = await params;
    const auth = await authorize(id, expenseIdRaw);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 });
    }

    const { keterangan, amount } = body as { keterangan?: unknown; amount?: unknown };

    const note = typeof keterangan === 'string' ? keterangan.trim() : '';
    if (!note) {
      return NextResponse.json({ error: 'Keterangan wajib diisi' }, { status: 400 });
    }
    if (note.length > 100) {
      return NextResponse.json({ error: 'Keterangan terlalu panjang (maksimal 100 karakter)' }, { status: 400 });
    }

    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Jumlah harus lebih dari 0' }, { status: 400 });
    }
    if (amountNum > MAX_AMOUNT) {
      return NextResponse.json({ error: 'Jumlah pengeluaran melebihi batas maksimum yang diperbolehkan' }, { status: 400 });
    }

    const updated = await updateShiftExpense(
      auth.expenseId,
      { amount: amountNum, note, categoryCustom: note },
      { userId: auth.payload.userId },
    );

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const mapped = toErrorResponse(error);
    if (mapped) return mapped;
    console.error('Update expense API error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan perubahan pengeluaran' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { id, expenseId: expenseIdRaw } = await params;
    const auth = await authorize(id, expenseIdRaw);
    if (auth instanceof NextResponse) return auth;

    await deleteShiftExpense(auth.expenseId, { userId: auth.payload.userId });

    return NextResponse.json({ ok: true, id: auth.expenseId });
  } catch (error: unknown) {
    const mapped = toErrorResponse(error);
    if (mapped) return mapped;
    console.error('Delete expense API error:', error);
    return NextResponse.json({ error: 'Gagal menghapus pengeluaran' }, { status: 500 });
  }
}
