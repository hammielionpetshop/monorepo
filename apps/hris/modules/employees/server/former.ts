import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { todayWib, type IsoDate } from '../rules/dates';

/** Nonaktif karena Berhenti atau Diberhentikan (spec L4g §3.7, §9 butir 6). `since` = tanggal mulai nonaktif. */
export type FormerStatus = { employeeId: number; since: IsoDate; reasonKind: 'RESIGNED' | 'DISMISSED' };

/** Mantan karyawan hari ini: kejadian terakhir yang sudah berlaku = nonaktif beralasan Berhenti/Diberhentikan. */
export async function formerEmployees(today: IsoDate = todayWib(), employeeId?: number): Promise<FormerStatus[]> {
  const rows = await db.execute<{ employee_id: number; kind: string; reason_kind: string | null; effective_on: string }>(sql`
    select distinct on (employee_id) employee_id, kind, reason_kind, effective_on::text
    from hris.employment_events
    where effective_on <= ${today} ${employeeId != null ? sql`and employee_id = ${employeeId}` : sql``}
    order by employee_id, effective_on desc, id desc`);
  return rows
    .filter((r) => r.kind === 'DEACTIVATE' && (r.reason_kind === 'RESIGNED' || r.reason_kind === 'DISMISSED'))
    .map((r) => ({ employeeId: Number(r.employee_id), since: r.effective_on as IsoDate, reasonKind: r.reason_kind as FormerStatus['reasonKind'] }));
}

export async function formerStatus(employeeId: number, today: IsoDate = todayWib()): Promise<FormerStatus | null> {
  return (await formerEmployees(today, employeeId))[0] ?? null;
}
