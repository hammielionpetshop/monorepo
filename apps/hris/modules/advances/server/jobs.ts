import { inArray } from 'drizzle-orm';
import { requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import { listEmployeesWithAnyAction } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { longDate, rupiah } from '../rules/advance';
import { loadAdvances } from './data';
import { carriedByAdvance } from './slip';

const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Mesin `advance-daily` 07.00 WIB (spec L5 §6; DRV-64, 130, 131): pengingat kasbon disetujui belum diberikan (mulai
 * keesokan hari disetujui), tanda "Lewat 2 hari", dan pemeriksa sisa = cicilan Terjadwal + sisa dibawa. Tidak ada yang
 * ditolak, hangus, atau disetujui otomatis.
 */
export async function runAdvanceDaily(now: Date = new Date()) {
  const today = todayWib(now);
  const all = await loadAdvances();
  const processDays = Number(await settingOn<number>('advance.process_days', today)) || 2;
  const finance = [...(await activeHrisAccounts(await listEmployeesWithAnyAction(['advance.hand_over']))).values()];
  const owners = [...(await activeHrisAccounts(await listEmployeesWithAnyAction([]))).values()];

  const waiting = all.filter((v) => v.stage === 'APPROVED' && v.row.decidedAt && wibDate(v.row.decidedAt) < today);
  if (waiting.length) {
    const oldest = waiting.map((v) => wibDate(v.row.decidedAt!)).sort()[0];
    const total = waiting.reduce((s, v) => s + (v.row.finalAmount ?? 0), 0);
    await db.transaction((tx) => notify(tx, [...new Set([...finance, ...owners])], {
      kind: 'advance.hand_over_reminder', title: `Ada ${waiting.length} kasbon disetujui belum diberikan, ${rupiah(total)}, paling lama sejak ${longDate(oldest)}.`,
      link: '/gaji/kasbon?tab=diberikan', entity: 'advance', entityId: waiting[0].row.id,
    }, null));
  }

  const ids = all.map((v) => v.row.requestId).filter((id): id is number => id != null);
  const reqs = ids.length ? await db.select({ id: requests.id, submittedAt: requests.submittedAt }).from(requests).where(inArray(requests.id, ids)) : [];
  const late = all.filter((v) => {
    if (v.stage !== 'WAITING_REVIEW' && v.stage !== 'REVIEWED') return false;
    const at = reqs.find((r) => r.id === v.row.requestId)?.submittedAt;
    return at && now.getTime() - at.getTime() >= processDays * 86_400_000;
  });
  if (late.length) {
    await db.transaction((tx) => notify(tx, [...new Set([...finance, ...owners])], {
      kind: 'advance.late', title: `${late.length} pengajuan kasbon lewat ${processDays} hari belum diputuskan.`,
      link: '/gaji/kasbon', entity: 'advance', entityId: late[0].row.id,
    }, null));
  }

  // Pemeriksa (DRV-131): sisa harus sama dengan cicilan Terjadwal + sisa potongan kasbon yang dibawa.
  const carried = await carriedByAdvance();
  const mismatch = all.filter((v) => v.handover && v.stage === 'RUNNING'
    && v.remaining !== v.installments.filter((i) => i.status === 'SCHEDULED').reduce((s, i) => s + i.amount, 0) + (carried.get(v.row.id) ?? 0));
  if (mismatch.length) {
    await db.transaction((tx) => notify(tx, owners, {
      kind: 'advance.mismatch', title: `Perlu perhatian: sisa ${mismatch.length} kasbon tidak sama dengan jadwal cicilannya (${mismatch.map((v) => v.row.number).join(', ')}).`,
      link: '/gaji/kasbon?tab=berjalan', entity: 'advance', entityId: mismatch[0].row.id,
    }, null));
  }
  return { reminded: waiting.length, late: late.length, mismatch: mismatch.length };
}
