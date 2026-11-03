import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { tripWageValues } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { DAY_STATUS_LABELS, dayStatusesOf, type DayStatus } from '@/modules/attendance';
import { listPeopleForModules, placementHistory, placementOn, todayWib } from '@/modules/employees';
import {
  dayLabel, fixableRate, fleetLabels, pairLabel, loadRates, rateById, rateOnDate, ritaseRows, rupiah, sameNumbers, tripNumbers, type RateNumbers, type RitaseRow,
} from '@/modules/logistics';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import {
  WAGE_KINDS, WAGE_VALUE_STATUS_LABELS, rateAmountFor, revalueCause, sameValue, valueNote, valueWage,
  type DayStatusValue, type PayBasis, type WageValue, type ZeroReason,
} from '../rules/trip-wages';
import { positionFlags } from './data';
import { loadWeekRegimes } from './slip-period';
import { nextWeek, prevWeek, weekOf } from '@/modules/logistics';
import { payslipPayments } from '@petshop/hris-db/schema/payroll';

// Buku Upah ritase (spec L7 §3.2, §3.3). Satu fungsi penilai: dijalankan sesudah trip Selesai, ritase tangan, batal
// ritase, tarif dibetulkan/diisi, dan oleh mesin harian (cadangan + status hari berubah). Hasil sama = tidak menulis apa pun.

type ValueRow = typeof tripWageValues.$inferSelect;
type Filter = Parameters<typeof ritaseRows>[0];

const ROLE_LABELS = { DRIVER: 'Driver', ASSISTANT: 'Kenek' } as const;
const KIND_LABELS = { RITASE: 'Ritase', SHOPPING: 'Upah belanja' } as const;
const dayStatusLabel = (s: DayStatusValue) => DAY_STATUS_LABELS[s as DayStatus] ?? s;

function asValue(row: ValueRow): WageValue {
  return {
    status: row.status as WageValue['status'], rateId: row.rateId, rateAmount: row.rateAmount, amount: row.amount, payBasis: row.payBasis as PayBasis,
    dayStatus: row.dayStatus as DayStatusValue | null, zeroReason: row.zeroReason as ZeroReason | null, needsLook: row.needsLook,
  };
}

/** Dasar gaji orang pada tanggal itu: jabatan dari riwayat penempatan, lalu pengaturan `position.pay_basis` jabatan itu. */
async function basisReader() {
  const cache = new Map<string, PayBasis>();
  return async (positionId: number | null, date: string): Promise<PayBasis> => {
    if (!positionId) return 'MONTHLY';
    const key = `${positionId}|${date}`;
    if (!cache.has(key)) cache.set(key, (await settingOn<string>('position.pay_basis', date, { positionId })) === 'WEEKLY' ? 'WEEKLY' : 'MONTHLY');
    return cache.get(key)!;
  };
}

/** Nilai yang seharusnya untuk tiap baris ritase (tanpa menulis). */
async function desiredValues(rows: RitaseRow[], now: Date): Promise<Map<number, WageValue>> {
  const live = rows.filter((r) => !r.cancelled);
  const out = new Map<number, WageValue>();
  if (!live.length) return out;
  const [rates, placements] = await Promise.all([loadRates(), placementHistory([...new Set(live.map((r) => r.employeeId))])]);
  const basisOn = await basisReader();
  const basis = new Map<number, PayBasis>();
  for (const row of live) {
    const placement = placementOn(placements.get(row.employeeId) ?? [], row.tripDate);
    basis.set(row.id, await basisOn(placement?.positionId ?? null, row.tripDate));
  }
  const monthlyDates = new Map<number, Set<string>>();
  for (const row of live) {
    if (basis.get(row.id) !== 'MONTHLY') continue;
    monthlyDates.set(row.employeeId, (monthlyDates.get(row.employeeId) ?? new Set()).add(row.tripDate));
  }
  const days = new Map<string, DayStatusValue | null>();
  for (const [employeeId, dates] of monthlyDates) {
    for (const [date, status] of await dayStatusesOf(employeeId, [...dates], now)) days.set(`${employeeId}|${date}`, status);
  }
  for (const row of live) {
    const rate = rateOnDate(rates, row.vehicleId, row.routeId, row.tripDate);
    out.set(row.id, valueWage({
      role: row.role, withAssistant: row.withAssistant, rate, payBasis: basis.get(row.id)!, dayStatus: days.get(`${row.employeeId}|${row.tripDate}`) ?? null,
    }));
  }
  return out;
}

/**
 * Samakan Buku Upah dengan baris ritase dalam lingkup `filter`: lahir, dibatalkan, atau dinilai ulang (baris lama
 * CANCELLED + baris baru). L7a belum punya slip mingguan, jadi baris lama selalu boleh digantikan; koreksi untuk slip
 * yang sudah ditutup (spec §3.3) menyusul bersama slip mingguan L7b.
 */
export async function syncTripWages(filter: Filter, actorAccountId: number | null = null, now: Date = new Date()) {
  const rows = await ritaseRows(filter);
  if (!rows.length) return { written: 0, cancelled: 0 };
  const desired = await desiredValues(rows, now);
  const labels = await fleetLabels();
  const tell: { employeeId: number; title: string; body: string; id: number }[] = [];
  const unratedNew = new Set<string>();
  const regimes = await loadWeekRegimes();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('payroll.trip_wage_values'))`);
    const existing = await tx.select().from(tripWageValues)
      .where(and(inArray(tripWageValues.wageId, rows.map((r) => r.id)), ne(tripWageValues.status, 'CANCELLED')));
    const liveOf = new Map(existing.map((v) => [v.wageId, v]));
    let written = 0;
    let cancelled = 0;
    for (const row of rows) {
      const old = liveOf.get(row.id) ?? null;
      if (row.cancelled) {
        if (!old) continue;
        await tx.update(tripWageValues).set({ status: 'CANCELLED', cancelledAt: now, cancelReason: `Ritase dibatalkan: ${row.cancelReason ?? '-'}` })
          .where(eq(tripWageValues.id, old.id));
        cancelled += 1;
        continue;
      }
      const next = desired.get(row.id)!;
      if (old && sameValue(asValue(old), next)) continue;
      const cause = old ? revalueCause(asValue(old), next, dayStatusLabel) : null;
      if (old) {
        await tx.update(tripWageValues).set({ status: 'CANCELLED', cancelledAt: now, cancelReason: `Dinilai ulang: ${cause}` })
          .where(eq(tripWageValues.id, old.id));
      }
      const [inserted] = await tx.insert(tripWageValues).values({
        wageId: row.id, employeeId: row.employeeId, kind: row.kind, wageDate: row.tripDate, weekStart: weekOf(row.tripDate, regimes).start, role: row.role,
        withAssistant: row.withAssistant, vehicleId: row.vehicleId, routeId: row.routeId, ...next,
        // Sudah dilihat ikut terbawa bila tandanya tetap (penilaian ulang karena sebab lain).
        ...(old?.lookedAt && old.needsLook && next.needsLook ? { lookedAt: old.lookedAt, lookedByAccountId: old.lookedByAccountId, lookNote: old.lookNote } : {}),
      }).returning({ id: tripWageValues.id });
      written += 1;
      if (next.status === 'UNRATED' && old?.status !== 'UNRATED') {
        unratedNew.add(pairLabel(labels.vehicles.get(row.vehicleId) ?? 'Mobil', labels.routes.get(row.routeId)?.name ?? 'rute'));
      }
      if (old) {
        await tx.update(tripWageValues).set({ replacedById: inserted.id }).where(eq(tripWageValues.id, old.id));
        if (old.amount !== next.amount || old.status !== next.status) {
          const route = labels.routes.get(row.routeId)?.name ?? 'rute';
          const after = next.status === 'UNRATED' ? 'belum bertarif' : rupiah(next.amount);
          tell.push({
            employeeId: row.employeeId, id: inserted.id,
            title: `${KIND_LABELS[row.kind]} ${route} ${dayLabel(row.tripDate)} dinilai ulang: ${rupiah(old.amount)} → ${after}`,
            body: `Sebab: ${cause}.`,
          });
        }
      }
    }
    if (tell.length) {
      const accounts = await activeHrisAccounts([...new Set(tell.map((t) => t.employeeId))]);
      for (const t of tell) {
        const account = accounts.get(t.employeeId);
        if (account) await notify(tx, [account], { kind: 'wage.trip_revalued', title: t.title, body: t.body, link: '/trip-saya', entity: 'trip_wage_value', entityId: t.id }, actorAccountId);
      }
    }
    // Pagar terakhir (spec §3.2 langkah 2): upah Belum bertarif masuk perhatian Pemilik/GM.
    if (unratedNew.size) {
      await notify(tx, await rateManagerAccounts(), {
        kind: 'wage.trip_unrated', title: `Ada upah ritase belum bertarif: ${[...unratedNew].join(', ')}`,
        body: 'Isi tarifnya di Pengaturan › Tarif Ritase; upahnya dinilai ulang otomatis.', link: '/pengaturan/tarif-ritase', entity: 'trip_rate', entityId: null,
      }, null);
    }
    return { written, cancelled };
  });
  return result;
}

/** Mesin harian `trip-wage-daily` (spec §6): 14 hari ke belakang (status hari, cadangan) + semua yang masih Belum bertarif. */
export async function runTripWageDaily(now: Date = new Date()) {
  const today = todayWib();
  const recent = await syncTripWages({ from: addDays(today, -14), to: today }, null, now);
  // Pemeriksa (60 hari): ritase tak batal yang belum punya upah berlaku, ditambah semua yang masih Belum bertarif.
  const [window, unrated] = await Promise.all([
    ritaseRows({ from: addDays(today, -60), to: addDays(today, -15) }),
    db.selectDistinct({ wageId: tripWageValues.wageId }).from(tripWageValues).where(eq(tripWageValues.status, 'UNRATED')),
  ]);
  const valued = window.length
    ? new Set((await db.select({ wageId: tripWageValues.wageId }).from(tripWageValues)
      .where(and(inArray(tripWageValues.wageId, window.map((w) => w.id)), ne(tripWageValues.status, 'CANCELLED')))).map((v) => v.wageId))
    : new Set<number>();
  const missing = window.filter((w) => !w.cancelled && !valued.has(w.id)).map((w) => w.id);
  const ids = [...new Set([...missing, ...unrated.map((u) => u.wageId)])];
  const older = ids.length ? await syncTripWages({ ids }, null, now) : { written: 0, cancelled: 0 };
  return { written: recent.written + older.written, cancelled: recent.cancelled + older.cancelled, missing: missing.length };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Orang yang upahnya boleh dilihat pelaku: jabatan bertanda "Gaji hanya terlihat Pemilik dan GM" hanya untuk Pemilik/GM. */
async function visiblePeople(actor: Actor) {
  const people = await listPeopleForModules();
  const flags = await positionFlags(people.map((p) => p.positionId), todayWib());
  return new Map(people.filter((p) => actor.fullAccess || !flags.get(p.positionId)?.ownerOnly).map((p) => [p.id, p]));
}

export type TripWageTab = 'ALL' | 'LOOK' | 'REVALUED' | 'UNRATED';

/** Upah Ritase (DRV-L05) per minggu upah (hari awal minggu dari pengaturan, bawaan Jumat–Kamis). */
export async function tripWagesScreen(actor: Actor | null, week: string | null, tab: TripWageTab) {
  if (!actor || !can(actor, 'wage.trip.view')) return null;
  const today = todayWib();
  const regimes = await loadWeekRegimes();
  const range = weekOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today, regimes);
  const { start, end } = range;
  const [rows, people, labels] = await Promise.all([
    db.select().from(tripWageValues).where(and(gte(tripWageValues.wageDate, start), lte(tripWageValues.wageDate, end))).orderBy(asc(tripWageValues.wageDate), asc(tripWageValues.id)),
    visiblePeople(actor), fleetLabels(),
  ]);
  const visible = rows.filter((r) => people.has(r.employeeId));
  const ritase = await ritaseRows({ ids: [...new Set(visible.map((r) => r.wageId))] });
  const ritaseOf = new Map(ritase.map((r) => [r.id, r]));
  const numbers = await tripNumbers([...new Set(ritase.map((r) => r.tripId).filter((id): id is number => id != null))]);
  const live = visible.filter((r) => r.status !== 'CANCELLED');
  const view = (r: ValueRow) => {
    const source = ritaseOf.get(r.wageId);
    const replacement = r.replacedById ? visible.find((x) => x.id === r.replacedById) : null;
    return {
      id: r.id, employeeId: r.employeeId, name: people.get(r.employeeId)?.name ?? `#${r.employeeId}`, date: r.wageDate, dateLabel: dayLabel(r.wageDate),
      role: ROLE_LABELS[r.role as 'DRIVER'], kind: KIND_LABELS[r.kind as 'RITASE'], vehicle: labels.vehicles.get(r.vehicleId) ?? '-',
      route: labels.routes.get(r.routeId)?.name ?? '-', withAssistant: r.withAssistant, amount: r.amount, rateAmount: r.rateAmount,
      note: valueNote({ status: r.status as WageValue['status'], zeroReason: r.zeroReason as ZeroReason | null }),
      dayStatus: r.dayStatus ? dayStatusLabel(r.dayStatus as DayStatusValue) : null, payBasis: r.payBasis === 'MONTHLY' ? 'Bulanan' : 'Mingguan',
      status: r.status, statusLabel: WAGE_VALUE_STATUS_LABELS[r.status as keyof typeof WAGE_VALUE_STATUS_LABELS],
      needsLook: r.needsLook, looked: !!r.lookedAt, lookNote: r.lookNote, cancelReason: r.cancelReason,
      replacedAmount: replacement ? replacement.amount : null,
      tripId: source?.tripId ?? null, tripNumber: source?.tripId ? numbers.get(source.tripId) ?? null : null, manual: source?.manual ?? false,
      vehicleId: r.vehicleId, routeId: r.routeId,
    };
  };
  const perPerson = new Map<number, { name: string; ritase: number; shopping: number; amount: number; unrated: number }>();
  for (const r of live) {
    const p = perPerson.get(r.employeeId) ?? { name: people.get(r.employeeId)?.name ?? `#${r.employeeId}`, ritase: 0, shopping: 0, amount: 0, unrated: 0 };
    if (r.kind === 'RITASE') p.ritase += 1; else p.shopping += 1;
    p.amount += r.amount;
    if (r.status === 'UNRATED') p.unrated += 1;
    perPerson.set(r.employeeId, p);
  }
  const list = tab === 'LOOK' ? live.filter((r) => r.needsLook)
    : tab === 'UNRATED' ? live.filter((r) => r.status === 'UNRATED')
      : tab === 'REVALUED' ? visible.filter((r) => r.status === 'CANCELLED')
        : live;
  return {
    start, end, prev: prevWeek(start, regimes).start, next: nextWeek(start, regimes).start, today, tab,
    counts: {
      all: live.length, look: live.filter((r) => r.needsLook && !r.lookedAt).length, revalued: visible.filter((r) => r.status === 'CANCELLED').length,
      unrated: live.filter((r) => r.status === 'UNRATED').length,
    },
    total: live.reduce((s, r) => s + r.amount, 0),
    people: [...perPerson.values()].sort((a, b) => a.name.localeCompare(b.name)),
    rows: list.map(view),
    canReview: can(actor, 'wage.trip.review'),
    canRate: can(actor, 'wage.rate.view'),
  };
}

/** Sudah dilihat (U5): HR, Pemilik, GM; catatan pilihan. Tidak mengubah uang. */
export async function markTripWageLooked(actor: Actor | null, id: number, note: string | null): Promise<ServiceResult> {
  if (!actor || !can(actor, 'wage.trip.review')) return { ok: false, status: 403, error: 'Anda tidak berhak melakukan tindakan ini.' };
  const [row] = await db.update(tripWageValues).set({ lookedAt: new Date(), lookedByAccountId: actor.accountId, lookNote: note?.trim() || null })
    .where(and(eq(tripWageValues.id, id), eq(tripWageValues.needsLook, true), sql`${tripWageValues.lookedAt} is null`, ne(tripWageValues.status, 'CANCELLED')))
    .returning({ id: tripWageValues.id });
  return row ? { ok: true, data: undefined } : { ok: false, status: 409, error: 'Baris ini sudah ditandai atau sudah dinilai ulang.' };
}

/**
 * Akibat Betulkan salah ketik (DRV-L04 langkah 2): ritase yang memakai baris tarif itu, angka lama → baru per orang.
 * Ditolak bila ada yang sudah masuk slip yang Dibayar (U4); slip yang baru ditutup menerima koreksi di slip berikutnya.
 * Jalan keluar bila ditolak: tarif baru + Bonus Bebas / Potongan Lain.
 */
export async function rateFixImpact(actor: Actor | null, rateId: number, numbers: RateNumbers | null) {
  if (!actor || !can(actor, 'wage.rate.manage')) return null;
  const rate = await rateById(rateId);
  const fixable = await fixableRate(rateId);
  if (!rate) return null;
  const used = await db.select().from(tripWageValues).where(and(eq(tripWageValues.rateId, rateId), ne(tripWageValues.status, 'CANCELLED')));
  const slipIds = [...new Set(used.map((r) => r.payslipId).filter((id): id is number => id != null))];
  const inSlip = slipIds.length > 0 && (await db.select({ id: payslipPayments.id }).from(payslipPayments)
    .where(and(inArray(payslipPayments.payslipId, slipIds), eq(payslipPayments.status, 'ACTIVE'))).limit(1)).length > 0;
  const names = new Map((await listPeopleForModules()).map((p) => [p.id, p.name]));
  const rows = used.map((r) => {
    const after = numbers && r.rateAmount != null ? (r.zeroReason === 'WORKDAY' || r.zeroReason === 'NOT_DAY_OFF' ? 0 : rateAmountFor(numbers, r.role as 'DRIVER', r.withAssistant)) : null;
    return { id: r.id, name: names.get(r.employeeId) ?? `#${r.employeeId}`, date: dayLabel(r.wageDate), role: ROLE_LABELS[r.role as 'DRIVER'], before: r.amount, after };
  });
  const perPerson = new Map<string, number>();
  for (const r of rows) if (r.after != null) perPerson.set(r.name, (perPerson.get(r.name) ?? 0) + r.after - r.before);
  return {
    rate: { id: rate.id, vehicleId: rate.vehicleId, routeId: rate.routeId, vehicle: rate.vehicle, route: rate.route, from: rate.effectiveFrom, fromLabel: dayLabel(rate.effectiveFrom),
      driverWithAssistant: rate.driverWithAssistant, driverAlone: rate.driverAlone, assistant: rate.assistant },
    fixable: !!fixable, same: numbers ? sameNumbers(rate, numbers) : false,
    blocked: inSlip ? 'Sebagian ritase dengan tarif ini sudah masuk slip yang Dibayar. Buat tarif baru ke depan; kekurangan dibayar lewat Bonus Bebas dan kelebihan ditagih lewat Potongan Lain.' : null,
    rows, perPerson: [...perPerson.entries()].map(([name, diff]) => ({ name, diff })),
  };
}

/** Kartu Beranda Pemilik/GM/HR: upah Belum bertarif (perlu tarif) dan Perlu dilihat yang belum ditandai. */
export async function tripWageAttention(actor: Actor | null) {
  if (!actor || !can(actor, 'wage.trip.view')) return null;
  const [unrated, look] = await Promise.all([
    can(actor, 'wage.rate.manage')
      ? db.select({ n: sql<number>`count(*)::int` }).from(tripWageValues).where(eq(tripWageValues.status, 'UNRATED'))
      : Promise.resolve([{ n: 0 }]),
    db.select({ n: sql<number>`count(*)::int` }).from(tripWageValues)
      .where(and(eq(tripWageValues.needsLook, true), sql`${tripWageValues.lookedAt} is null`, ne(tripWageValues.status, 'CANCELLED'))),
  ]);
  const result = { unrated: Number(unrated[0]?.n ?? 0), look: Number(look[0]?.n ?? 0) };
  return result.unrated || result.look ? result : null;
}

/** Penerima "perlu perhatian" Belum bertarif: pemegang hak ubah tarif (Pemilik, GM). */
export async function rateManagerAccounts(): Promise<number[]> {
  return [...(await activeHrisAccounts(await listEmployeesWithAnyAction(['wage.rate.manage']))).values()];
}

export function wageKindsScreen(actor: Actor | null) {
  if (!actor || !can(actor, 'wage.rate.view')) return null;
  return { kinds: WAGE_KINDS.map((k) => ({ ...k })) };
}


