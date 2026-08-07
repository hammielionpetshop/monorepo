import { db, shifts, and, count, eq, sql } from '@/lib/db';

// Kunci advisory agar dua proses bersamaan di cabang yang sama tidak sama-sama
// membuka shift baru. Angka pertama hanya namespace bebas, yang kedua branchId.
const SHIFT_LOCK_NAMESPACE = 815_001;

export async function findOpenShiftId(
  runner: Pick<typeof db, 'select'>,
  branchId: number,
) {
  const rows = await runner
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')));
  if (rows.length > 1) throw new Error('MULTIPLE_OPEN_SHIFTS');
  return rows[0]?.id ?? null;
}

// Dipakai oleh alur yang wajib menempel ke shift (bulk sale, pelunasan piutang tunai) tetapi
// cabangnya belum tentu menjalankan shift kasir — mis. Gudang sebagai cabang pengirim Internal PO,
// atau pelunasan yang dicatat dari backoffice di luar jam kasir. Kalau belum ada shift terbuka,
// buka sendiri satu shift bertanda BACKOFFICE — modal awal 0, tanpa kasir yang perlu join —
// supaya uangnya tetap punya wadah kas yang bisa disettle.
export async function resolveShiftId(branchId: number, userId: number) {
  const existing = await findOpenShiftId(db, branchId);
  if (existing !== null) return existing;

  return await db.transaction(async (trx) => {
    await trx.execute(
      sql`SELECT pg_advisory_xact_lock(${SHIFT_LOCK_NAMESPACE}, ${branchId})`,
    );

    const afterLock = await findOpenShiftId(trx, branchId);
    if (afterLock !== null) return afterLock;

    const [todayCount] = await trx
      .select({ total: count() })
      .from(shifts)
      .where(
        and(eq(shifts.branchId, branchId), sql`DATE(${shifts.openedAt}) = CURRENT_DATE`),
      );

    const [created] = await trx
      .insert(shifts)
      .values({
        branchId,
        openedById: userId,
        shiftNumber: Number(todayCount?.total ?? 0) + 1,
        assignedCashiers: [userId],
        openingCash: 0,
        status: 'OPEN',
        origin: 'BACKOFFICE',
      })
      .returning({ id: shifts.id });

    return created.id;
  });
}
