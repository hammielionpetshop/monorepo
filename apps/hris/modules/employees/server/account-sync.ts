import { and, eq, isNull, lte } from 'drizzle-orm';
import { setHrisLinkedAccountActive } from '@petshop/auth';
import { employmentEvents } from '@petshop/hris-db/schema/employees';
import { getAuthSql } from '@/lib/auth';
import { db } from '@/lib/db';
import { todayWib } from '../rules/dates';
import { activeOn } from '../rules/history';
import { loadBundle, pendingStatusEmployees, toEventRecords } from './data';
import { formerEmployees, formerStatus } from './former';

/**
 * Masih punya urusan gaji? (spec L4g §3.7, `hasMoneyMatters` di modul gaji). Dirangkai app/ supaya modul karyawan
 * tidak mengimpor modul gaji.
 */
export type KeepsHrisAccess = (employeeId: number) => Promise<boolean>;

/**
 * Mengikutkan akun pusat pada status karyawan hari ini (KAR-07, 69), lalu menandai kejadian yang sudah
 * berlaku sebagai terterapkan. Aman diulang: dipanggil langsung sesudah simpan dan oleh job harian.
 * Akses HRIS orang nonaktif sudah tertutup lewat penempatan hari ini walau langkah ini gagal.
 * Mantan karyawan (Berhenti/Diberhentikan) yang masih punya urusan gaji: akun tetap aktif khusus HRIS, tautan
 * backoffice dicabut (spec L4g §3.7, keputusan owner 2026-11-03).
 */
export async function syncAccountStatus(employeeId: number, actorAccountId: number | null, keepsHrisAccess: KeepsHrisAccess) {
  const bundle = await loadBundle(db, employeeId);
  if (!bundle) return { applied: false, accountChanged: false };
  const today = todayWib();
  const active = activeOn(toEventRecords(bundle.events), today);
  const hrisOnly = !active && (await formerStatus(employeeId, today)) != null && (await keepsHrisAccess(employeeId));
  const result = await setHrisLinkedAccountActive(getAuthSql(), {
    employeeId, active: active || hrisOnly, hrisOnly, actorAccountId,
    reason: active ? 'karyawan aktif kembali' : hrisOnly ? 'mantan karyawan masih punya urusan gaji' : 'karyawan dinonaktifkan',
  });
  if (!result.ok) throw new Error(`Gagal menyesuaikan akun pusat karyawan #${employeeId}: ${result.error}`);
  await db.update(employmentEvents).set({ accountAppliedAt: new Date() }).where(and(
    eq(employmentEvents.employeeId, employeeId), isNull(employmentEvents.accountAppliedAt),
    lte(employmentEvents.effectiveOn, today),
  ));
  return { applied: true, accountChanged: result.changed };
}

/**
 * Job harian `employee-status-apply` (00.01 WIB): nonaktif/aktif lagi bertanggal depan yang tiba hari ini, ditambah
 * semua mantan karyawan supaya akses terbatasnya tertutup sesudah urusan gajinya selesai (atau terbuka lagi bila
 * muncul urusan baru, mis. tagihan luar slip).
 */
export async function applyDueEmploymentStatus(keepsHrisAccess: KeepsHrisAccess) {
  const today = todayWib();
  const ids = [...new Set([...(await pendingStatusEmployees(db, today)), ...(await formerEmployees(today)).map((f) => f.employeeId)])];
  let accountsChanged = 0;
  const failed: number[] = [];
  for (const id of ids) {
    try {
      if ((await syncAccountStatus(id, null, keepsHrisAccess)).accountChanged) accountsChanged += 1;
    } catch {
      failed.push(id);
    }
  }
  if (failed.length) throw new Error(`Status akun gagal disesuaikan untuk karyawan: ${failed.join(', ')}.`);
  return { employees: ids.length, accountsChanged };
}
