import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { can, recordAudit, type Actor } from '@/modules/access';
import {
  REPORT_TABS, isReportTab, periodChoices, reportCsv, reportRange, reportTable,
  type CrewRole, type FuelFact, type MoneyCheckFact, type Outcome, type PayMethod, type RangeQuery, type ReportFact, type ReportFacts,
  type ReportParts, type ReportRange, type ReportTab, type TripFact, type VehicleAttentionFact, type VisitFact, type WageFact,
} from '../rules/logistics-report';
import { wibClock, wibDate } from '../rules/trip';
import { peopleNames } from './data';

// Laporan Logistik (spec LT1 §17.2; LOG-81, 145): hanya membaca. Dasar tanggal = tanggal kirim (tanggal trip / mulai antar
// sendiri), retur = tanggal dilaporkan diambil, bensin = tanggal isi. Uang dari cara bayar awak + Terima Uang; tanpa piutang.

const VIEW = 'logistics.report.view';
const SHORTAGE = ['logistics.money_check.do', 'logistics.store_payment.view'] as const;
const FUEL = ['logistics.vehicle_followup.manage', 'logistics.fuel.record'] as const;

/** Bagian yang terlihat (§17.2 butir 6): sama dengan Dashboard — Marketing tanpa bensin dan kurang serah. */
export function reportParts(actor: Actor | null): ReportParts | null {
  if (!actor || !can(actor, VIEW)) return null;
  return { fuel: FUEL.some((a) => can(actor, a)), shortage: SHORTAGE.some((a) => can(actor, a)) };
}

export type ReportQuery = RangeQuery & { tab?: string };

const TRUCK_TRIPS = (r: ReportRange) => sql`t.status in ('RUNNING', 'DONE') and t.trip_date between ${r.from}::date and ${r.to}::date`;
const SELF_TRIPS = (r: ReportRange) => sql`(s.started_at at time zone 'Asia/Jakarta')::date between ${r.from}::date and ${r.to}::date`;
const PROCESSED = sql`('DELIVERED', 'TOMORROW', 'FAILED')`;

type Num = number | string;

/** Semua fakta rentang ini dalam beberapa kueri baca. */
export async function loadReportFacts(range: ReportRange): Promise<ReportFacts> {
  const [
    truckTrips, truckCrew, selfTrips, truckVisits, truckNotes, truckChecks, selfStops, selfChecks, wages, fuel, reports, attention,
    vehicles, customers, people,
  ] = await Promise.all([
    db.execute<{ id: Num; number: string; trip_date: string; vehicle_id: Num; vehicle: string; route: string | null }>(sql`
      select t.id, t.number, t.trip_date::text as trip_date, t.vehicle_id, v.name || ' (' || v.plate || ')' as vehicle, r.name as route
      from logistics.trips t join logistics.vehicles v on v.id = t.vehicle_id left join logistics.routes r on r.id = t.route_id
      where ${TRUCK_TRIPS(range)}`),
    db.execute<{ trip_id: Num; employee_id: Num; role: 'DRIVER' | 'ASSISTANT' }>(sql`
      select c.trip_id, c.employee_id, c.role from logistics.trip_crew c join logistics.trips t on t.id = c.trip_id
      where c.removed_at is null and ${TRUCK_TRIPS(range)}`),
    db.execute<{ id: Num; number: string; day: string; employee_id: Num; branch: string | null }>(sql`
      select s.id, s.number, (s.started_at at time zone 'Asia/Jakarta')::date::text as day, s.employee_id, b.name as branch
      from logistics.self_trips s left join hris.branches b on b.id = s.branch_id
      where ${SELF_TRIPS(range)}`),
    db.execute<{ id: Num; trip_id: Num; customer_id: Num | null; destination_name: string; status: Outcome; payment_id: Num | null; method: PayMethod | null; received: Num | null; not_ok: boolean }>(sql`
      select v.id, v.trip_id, v.customer_id, v.destination_name, v.status, p.id as payment_id, p.method, p.received_amount as received,
        exists (select 1 from logistics.outside_point_reviews o where o.visit_id = v.id and o.verdict = 'NOT_OK') as not_ok
      from logistics.trip_visits v join logistics.trips t on t.id = v.trip_id
      left join logistics.visit_payments p on p.visit_id = v.id and p.replaced_at is null
      where v.status in ${PROCESSED} and ${TRUCK_TRIPS(range)}`),
    db.execute<{ visit_id: Num; note_id: Num; kind: 'SALE' | 'TRANSFER'; branch: string }>(sql`
      select distinct n.visit_id, d.id as note_id, d.kind,
        coalesce(ps.branch_name, px.source_branch_name, 'Cabang #' || d.origin_branch_id) as branch
      from logistics.trip_visit_notes n
      join logistics.trip_visits v on v.id = n.visit_id join logistics.trips t on t.id = v.trip_id
      join logistics.delivery_notes d on d.id = n.note_id
      left join logistics.pos_truck_sales ps on d.kind = 'SALE' and ps.id = d.doc_id
      left join logistics.pos_truck_transfers px on d.kind = 'TRANSFER' and px.id = d.doc_id
      where v.status in ${PROCESSED} and ${TRUCK_TRIPS(range)}`),
    db.execute<{ payment_id: Num; kind: 'CASH' | 'TRANSFER'; reported: Num; actual: Num; responsible: Num | null }>(sql`
      select c.visit_payment_id as payment_id, c.kind, c.reported_amount as reported, c.actual_amount as actual, c.responsible_employee_id as responsible
      from logistics.money_checks c join logistics.trips t on t.id = c.trip_id
      where c.voided_at is null and c.source = 'TRUCK' and ${TRUCK_TRIPS(range)}`),
    db.execute<{ id: Num; trip_id: Num; customer_id: Num | null; destination_name: string; status: Outcome; branch: string | null; payment_id: Num | null; method: PayMethod | null; received: Num | null; not_ok: boolean }>(sql`
      select st.id, st.trip_id, st.customer_id, st.destination_name, st.status, cs.branch_name as branch,
        p.id as payment_id, p.method, p.received_amount as received,
        exists (select 1 from logistics.outside_point_reviews o where o.self_stop_id = st.id and o.verdict = 'NOT_OK') as not_ok
      from logistics.self_trip_stops st join logistics.self_trips s on s.id = st.trip_id
      left join logistics.pos_courier_sales cs on cs.id = st.transaction_id
      left join logistics.self_trip_payments p on p.stop_id = st.id and p.replaced_at is null
      where st.status in ${PROCESSED} and ${SELF_TRIPS(range)}`),
    db.execute<{ payment_id: Num; kind: 'CASH' | 'TRANSFER'; reported: Num; actual: Num; responsible: Num | null }>(sql`
      select c.self_payment_id as payment_id, c.kind, c.reported_amount as reported, c.actual_amount as actual, c.responsible_employee_id as responsible
      from logistics.money_checks c join logistics.self_trips s on s.id = c.self_trip_id
      where c.voided_at is null and c.source = 'SELF' and ${SELF_TRIPS(range)}`),
    db.execute<{ trip_id: Num | null; employee_id: Num; role: 'DRIVER' | 'ASSISTANT'; kind: 'RITASE' | 'SHOPPING'; vehicle_id: Num }>(sql`
      select trip_id, employee_id, role, kind, vehicle_id from logistics.trip_wages
      where cancelled_at is null and trip_date between ${range.from}::date and ${range.to}::date`),
    db.execute<{ vehicle_id: Num; vehicle: string; driver_employee_id: Num; amount: Num; with_request: boolean }>(sql`
      select vehicle_id, vehicle_name || ' (' || vehicle_plate || ')' as vehicle, driver_employee_id, amount, with_request
      from logistics.fuel_expenses where filled_on between ${range.from}::date and ${range.to}::date`),
    db.execute<{ trip_key: string; customer_id: Num | null; destination: string; kind: string }>(sql`
      select coalesce('T' || r.trip_id, 'S' || r.self_trip_id) as trip_key, r.customer_id, coalesce(v.destination_name, st.destination_name, '-') as destination, r.kind
      from logistics.visit_reports r
      left join logistics.trip_visits v on v.id = r.visit_id
      left join logistics.self_trip_stops st on st.id = r.self_stop_id
      where (r.reported_at at time zone 'Asia/Jakarta')::date between ${range.from}::date and ${range.to}::date`),
    db.execute<{ vehicle_id: Num }>(sql`
      select vehicle_id from logistics.trip_end_reports
      where condition = 'ATTENTION' and (sent_at at time zone 'Asia/Jakarta')::date between ${range.from}::date and ${range.to}::date`),
    db.execute<{ id: Num; label: string }>(sql`select id, name || ' (' || plate || ')' as label from logistics.vehicles`),
    db.execute<{ id: Num; name: string }>(sql`
      select c.id, c.name from logistics.pos_customers c
      where c.id in (select customer_id from logistics.trip_visits where customer_id is not null
        union select customer_id from logistics.self_trip_stops where customer_id is not null)`),
    peopleNames(),
  ]);

  const crewOf = new Map<string, TripFact['crew']>();
  for (const c of truckCrew) {
    const key = `T${c.trip_id}`;
    crewOf.set(key, [...(crewOf.get(key) ?? []), { employeeId: Number(c.employee_id), role: c.role as CrewRole }]);
  }
  const trips: TripFact[] = [
    ...truckTrips.map((t) => ({
      source: 'TRUCK' as const, key: `T${t.id}`, number: t.number, date: t.trip_date, vehicleId: Number(t.vehicle_id), vehicle: t.vehicle,
      route: t.route, branch: null, crew: crewOf.get(`T${t.id}`) ?? [],
    })),
    ...selfTrips.map((s) => ({
      source: 'SELF' as const, key: `S${s.id}`, number: s.number, date: s.day, vehicleId: null, vehicle: null, route: null, branch: s.branch,
      crew: [{ employeeId: Number(s.employee_id), role: 'PJ' as const }],
    })),
  ];

  const check = (c: { kind: 'CASH' | 'TRANSFER'; reported: Num; actual: Num; responsible: Num | null }): MoneyCheckFact => ({
    kind: c.kind, reported: Number(c.reported), actual: Number(c.actual), responsibleEmployeeId: c.responsible == null ? null : Number(c.responsible),
  });
  const group = <T,>(rows: T[], key: (r: T) => string) => {
    const out = new Map<string, T[]>();
    for (const r of rows) out.set(key(r), [...(out.get(key(r)) ?? []), r]);
    return out;
  };
  const truckChecksBy = group(truckChecks, (c) => String(c.payment_id));
  const selfChecksBy = group(selfChecks, (c) => String(c.payment_id));
  const notesBy = group(truckNotes, (n) => String(n.visit_id));

  const visits: VisitFact[] = [
    ...truckVisits.map((v) => ({
      source: 'TRUCK' as const, tripKey: `T${v.trip_id}`, customerId: v.customer_id == null ? null : Number(v.customer_id),
      destination: v.destination_name, outcome: v.status,
      notes: (notesBy.get(String(v.id)) ?? []).map((n) => ({ branch: n.branch, kind: n.kind })),
      method: v.method, received: Number(v.received ?? 0),
      checks: v.payment_id == null ? [] : (truckChecksBy.get(String(v.payment_id)) ?? []).map(check),
      notOk: v.not_ok,
    })),
    ...selfStops.map((s) => ({
      source: 'SELF' as const, tripKey: `S${s.trip_id}`, customerId: s.customer_id == null ? null : Number(s.customer_id),
      destination: s.destination_name, outcome: s.status,
      notes: [{ branch: s.branch ?? '-', kind: 'SALE' as const }],
      method: s.method, received: Number(s.received ?? 0),
      checks: s.payment_id == null ? [] : (selfChecksBy.get(String(s.payment_id)) ?? []).map(check),
      notOk: s.not_ok,
    })),
  ];

  return {
    trips, visits,
    wages: wages.map((w): WageFact => ({
      tripKey: w.trip_id == null ? null : `T${w.trip_id}`, employeeId: Number(w.employee_id), role: w.role, kind: w.kind, vehicleId: Number(w.vehicle_id),
    })),
    fuel: fuel.map((f): FuelFact => ({
      vehicleId: Number(f.vehicle_id), vehicle: f.vehicle, driverEmployeeId: Number(f.driver_employee_id), amount: Number(f.amount), withRequest: f.with_request,
    })),
    reports: reports.map((r): ReportFact => ({
      tripKey: r.trip_key, customerId: r.customer_id == null ? null : Number(r.customer_id), destination: r.destination, isReturn: r.kind === 'RETURN',
    })),
    vehicleAttention: attention.map((a): VehicleAttentionFact => ({ vehicleId: Number(a.vehicle_id) })),
    vehicles: new Map(vehicles.map((v) => [Number(v.id), v.label])),
    customers: new Map(customers.map((c) => [Number(c.id), c.name])),
    people,
  };
}

/** Layar Laporan Logistik: rentang, tab, dan tabel tab itu. */
export async function logisticsReportScreen(actor: Actor | null, q: ReportQuery, now: Date = new Date()) {
  const parts = reportParts(actor);
  if (!parts) return null;
  const today = wibDate(now);
  const parsed = reportRange(q, today);
  const tab: ReportTab = isReportTab(q.tab) ? q.tab : 'ringkasan';
  const table = reportTable(tab, await loadReportFacts(parsed.range), parts);
  return {
    tab, tabs: REPORT_TABS, parts, table,
    range: parsed.range, error: parsed.ok ? null : parsed.error,
    periods: periodChoices(today),
    query: { periode: parsed.range.free ? '' : parsed.range.from, dari: parsed.range.free ? parsed.range.from : '', sampai: parsed.range.free ? parsed.range.to : '' },
    readAt: wibClock(now),
  };
}

/** Unduh CSV satu tab, dibuat di server; tiap unduhan dicatat di jejak perubahan (LOG-145). */
export async function logisticsReportDownload(actor: Actor | null, q: ReportQuery, now: Date = new Date()): Promise<{ filename: string; csv: string } | null> {
  const parts = reportParts(actor);
  if (!actor || !parts) return null;
  const parsed = reportRange(q, wibDate(now));
  if (!parsed.ok) return null;
  const tab: ReportTab = isReportTab(q.tab) ? q.tab : 'ringkasan';
  const table = reportTable(tab, await loadReportFacts(parsed.range), parts);
  const madeBy = (await peopleNames()).get(actor.personId) ?? `Akun #${actor.accountId}`;
  await db.transaction(async (tx) => {
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'logistics_report', entityId: null, action: 'DOWNLOAD',
      after: { tab, from: parsed.range.from, to: parsed.range.to, rows: table.rows.length, fuel: parts.fuel, shortage: parts.shortage },
    });
  });
  const tabLabel = REPORT_TABS.find((t) => t.key === tab)?.label ?? tab;
  return {
    filename: `laporan-logistik-${tab}-${parsed.range.from}-sd-${parsed.range.to}.csv`,
    csv: reportCsv(table, { title: `Laporan Logistik — ${tabLabel}`, range: parsed.range.label, madeBy, madeAt: `${wibDate(now)} ${wibClock(now)} WIB` }),
  };
}
