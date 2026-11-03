import { and, desc, eq, sql } from 'drizzle-orm';
import { payslipObjections, payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, type Actor, type ChangeAnnounce, type ServiceResult } from '@/modules/access';
import { notify } from '@/modules/notifications';
import { checkReason } from '@/modules/settings';
import { cleanLines, isPeriodStart, linesProblem, longDate, monthlyTotal, packageOn, rupiah, type IsoDate, type SalaryLine } from '../rules/salary';
import { accountOf, canSeeSalary, directChangeProblem, loadPackages, loadPayrollPeople, loadTypes, type PayrollPerson } from './data';
import { loadSlip, periodLabel } from './payslip';
import { correctableObjections } from './slip-objection';
import { writePackage } from './write';

// Pembetulan gaji periode lalu (spec L4g §3.6, GAJ-112): pengecualian GAJ-63. Hanya Pemilik atau GM; slip lama tidak diubah,
// selisih gaji tetap masuk Koreksi Periode Lalu di slip berikutnya (atau bayar di luar slip / Piutang Lain bila tanpa slip berikutnya).

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/** Orang dari daftar hari ini, atau dari slip tertutup terakhirnya (mantan karyawan dengan slip terakhir). */
async function findPerson(employeeId: number): Promise<PayrollPerson | null> {
  const today = (await loadPayrollPeople()).find((p) => p.id === employeeId);
  if (today) return today;
  const [last] = await db.select({ id: payslips.id }).from(payslips)
    .where(and(eq(payslips.employeeId, employeeId), eq(payslips.status, 'CLOSED'))).orderBy(desc(payslips.periodStart)).limit(1);
  return last ? (await loadSlip(last.id))?.person ?? null : null;
}

/** Periode yang slipnya sudah ditutup: hanya di sini pembetulan berlaku (periode terbuka memakai Ubah Gaji biasa). */
async function closedPeriodsOf(employeeId: number): Promise<IsoDate[]> {
  const rows = await db.select({ periodStart: payslips.periodStart }).from(payslips)
    .where(and(eq(payslips.employeeId, employeeId), eq(payslips.status, 'CLOSED'))).orderBy(desc(payslips.periodStart));
  return rows.map((r) => r.periodStart);
}

async function guard(actor: Actor | null, employeeId: number): Promise<{ person: PayrollPerson } | Fail> {
  const person = await findPerson(employeeId);
  if (!person || !canSeeSalary(actor, person)) return fail(404, 'Orang ini tidak ditemukan di daftar gaji bulanan.');
  if (!actor?.fullAccess || !can(actor, 'salary.change', person.target)) return fail(403, 'Pembetulan gaji periode lalu hanya oleh Pemilik atau GM.');
  const self = await directChangeProblem(actor, person);
  if (self) return fail(403, self);
  return { person };
}

export async function salaryCorrectionScreen(actor: Actor | null, employeeId: number, objectionInput: number | null) {
  const checked = await guard(actor, employeeId);
  if ('ok' in checked) return null;
  const { person } = checked;
  const [periods, packages, types, objections] = await Promise.all([
    closedPeriodsOf(person.id), loadPackages([person.id]), loadTypes(), correctableObjections(person.id),
  ]);
  const list = packages.get(person.id) ?? [];
  const typeNames = new Map(types.map((t) => [t.id, t.name]));
  const chosen = objections.find((o) => o.id === objectionInput) ?? null;
  return {
    person: { id: person.id, name: person.name },
    periods: periods.map((start) => {
      const pkg = packageOn(list, start);
      return {
        start, label: periodLabel(start), lines: pkg ? pkg.lines : [],
        text: pkg ? `${rupiah(monthlyTotal(pkg.lines))}/bulan: ${pkg.lines.map((l) => `${typeNames.get(l.componentTypeId) ?? '?'} ${rupiah(l.amount)}`).join(', ')}` : 'Belum ada gaji',
      };
    }),
    types: types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })),
    objections: objections.map((o) => ({ id: o.id, text: o.text, periodStart: o.periodStart })),
    chosenObjectionId: chosen?.id ?? null,
    chosenPeriod: chosen?.periodStart ?? null,
  };
}

/** Simpan pembetulan: paket asal CORRECTION bertanggal periode tertutup; paket lain di tanggal itu diganti. */
export async function correctPastSalary(
  actor: Actor | null, input: { employeeId: number; effectiveFrom: unknown; lines: unknown; reason: unknown; objectionId: number | null }, announce: ChangeAnnounce,
): Promise<ServiceResult<{ id: number; message: string }>> {
  const checked = await guard(actor, input.employeeId);
  if ('ok' in checked) return checked;
  const { person } = checked;
  if (!isPeriodStart(input.effectiveFrom)) return fail(400, 'Pilih periode yang dibetulkan.');
  const effectiveFrom = input.effectiveFrom;
  if (!(await closedPeriodsOf(person.id)).includes(effectiveFrom)) {
    return fail(400, 'Pembetulan hanya untuk periode yang slipnya sudah ditutup. Periode terbuka memakai Ubah Gaji.');
  }
  const types = await loadTypes();
  const problem = linesProblem(input.lines, new Set(types.filter((t) => t.active).map((t) => t.id)));
  if (problem) return fail(400, problem);
  const lines: SalaryLine[] = cleanLines(input.lines as SalaryLine[]);
  const reason = await checkReason(input.reason, 'Alasan pembetulan');
  if (!reason.ok) return fail(400, reason.error);
  // Wajib menunjuk keberatan slip yang Disetujui, atau alasan tertulis bila kesalahan ditemukan kantor sendiri (GAJ-112).
  if (input.objectionId != null && !(await correctableObjections(person.id)).some((o) => o.id === input.objectionId)) {
    return fail(400, 'Keberatan slip itu tidak sedang menunggu pembetulan untuk orang ini.');
  }
  const before = packageOn((await loadPackages([person.id])).get(person.id) ?? [], effectiveFrom);
  if (before && monthlyTotal(before.lines) === monthlyTotal(lines) && JSON.stringify(cleanLines(before.lines)) === JSON.stringify(lines)) {
    return fail(400, 'Isinya sama dengan gaji periode itu.');
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`salary:${person.id}`}))`);
    if (input.objectionId != null) {
      const [o] = await tx.select().from(payslipObjections).where(eq(payslipObjections.id, input.objectionId)).for('update');
      if (!o || o.fixStatus !== 'WAITING_FIX') return fail(409, 'Keberatan slip itu sudah tidak menunggu pembetulan.');
    }
    const id = await writePackage(tx, {
      employeeId: person.id, effectiveFrom, lines, origin: 'CORRECTION', reason: reason.reason, actorAccountId: actor!.accountId, objectionId: input.objectionId,
    });
    const when = periodLabel(effectiveFrom);
    const account = await accountOf(person.id);
    if (account) {
      await notify(tx, [account], {
        kind: 'salary.corrected', title: `Gaji Anda periode ${when} dibetulkan.`,
        body: `Alasan: ${reason.reason}. Selisihnya masuk Koreksi Periode Lalu di slip berikutnya.`, entity: 'salary_change', entityId: id, link: '/pendapatan',
      }, actor!.accountId);
    }
    await announce(tx, actor!.accountId, { what: `membetulkan gaji ${person.name} periode ${when}: ${reason.reason}`, link: `/gaji/${person.id}`, entity: 'salary_change', entityId: id });
    return {
      ok: true as const,
      data: {
        id,
        message: `Gaji ${person.name} mulai ${longDate(effectiveFrom)} dibetulkan menjadi ${rupiah(monthlyTotal(lines))}. Slip lama tidak berubah; selisihnya masuk Koreksi Periode Lalu. ${input.objectionId ? 'Tautkan pembetulan ini di keberatannya sesudah slip berikutnya ditutup, atau tautkan perubahan gaji ini sekarang.' : ''}`.trim(),
      },
    };
  });
}
