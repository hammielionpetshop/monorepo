import { and, eq, isNull, lte } from 'drizzle-orm';
import { setHrisLinkedAccountActive } from '@petshop/auth';
import { employmentEvents } from '@petshop/hris-db/schema/employees';
import { getAuthSql } from '@/lib/auth';
import { db } from '@/lib/db';
import { todayWib } from '../rules/dates';
import { activeOn } from '../rules/history';
import { loadBundle, pendingStatusEmployees, toEventRecords } from './data';

/**
 * Mengikutkan akun pusat pada status karyawan hari ini (KAR-07, 69), lalu menandai kejadian yang sudah
 * berlaku sebagai terterapkan. Aman diulang: dipanggil langsung sesudah simpan dan oleh job harian.
 * Akses HRIS orang nonaktif sudah tertutup lewat penempatan hari ini walau langkah ini gagal.
 */
export async function syncAccountStatus(employeeId: number, actorAccountId: number | null) {
  const bundle = await loadBundle(db, employeeId);
  if (!bundle) return { applied: false, accountChanged: false };
  const today = todayWib();
  const active = activeOn(toEventRecords(bundle.events), today);
  const result = await setHrisLinkedAccountActive(getAuthSql(), {
    employeeId, active, actorAccountId,
    reason: active ? 'karyawan aktif kembali' : 'karyawan dinonaktifkan',
  });
  if (!result.ok) throw new Error(`Gagal menyesuaikan akun pusat karyawan #${employeeId}: ${result.error}`);
  await db.update(employmentEvents).set({ accountAppliedAt: new Date() }).where(and(
    eq(employmentEvents.employeeId, employeeId), isNull(employmentEvents.accountAppliedAt),
    lte(employmentEvents.effectiveOn, today),
  ));
  return { applied: true, accountChanged: result.changed };
}

/** Job harian `employee-status-apply` (00.01 WIB): nonaktif/aktif lagi bertanggal depan yang tiba hari ini. */
export async function applyDueEmploymentStatus() {
  const ids = await pendingStatusEmployees(db, todayWib());
  let accountsChanged = 0;
  const failed: number[] = [];
  for (const id of ids) {
    try {
      if ((await syncAccountStatus(id, null)).accountChanged) accountsChanged += 1;
    } catch {
      failed.push(id);
    }
  }
  if (failed.length) throw new Error(`Status akun gagal disesuaikan untuk karyawan: ${failed.join(', ')}.`);
  return { employees: ids.length, accountsChanged };
}
