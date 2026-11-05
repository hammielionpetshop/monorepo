import { sql } from 'drizzle-orm';
import { outsidePointReviews } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult } from '@/modules/access';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { addDays, reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames } from './data';
import { ownerAccounts } from './fuel';

// Tinjau kiriman di luar titik toko (spec LT1 §17.1 butir 9; LOG-142): Wajar / Tidak wajar, tanpa potongan otomatis.

const REVIEW = 'logistics.outside_point.review';
export const OUTSIDE_RED_DAYS = 3;

export type OutsideKind = 'TRUCK' | 'SELF';

type Raw = {
  kind: OutsideKind; id: number; trip_id: number; trip_number: string; store: string; done_at: string; distance_m: number; crew: number[];
  verdict: string | null; reason: string | null; reviewed_at: string | null; reviewed_by: string | null;
};

async function loadOutside(from: IsoDate, radius: number, reviewed: boolean | null): Promise<Raw[]> {
  const reviewedWhere = reviewed == null ? sql`true` : reviewed ? sql`r.id is not null and r.reviewed_at > now() - interval '30 days'` : sql`r.id is null`;
  return db.execute<Raw>(sql`
    select * from (
      select 'TRUCK' as kind, v.id, v.trip_id, t.number as trip_number, v.destination_name as store, v.processed_at as done_at, v.distance_m,
        coalesce((select array_agg(c.employee_id) from logistics.trip_crew c where c.trip_id = v.trip_id and c.removed_at is null), '{}') as crew,
        r.verdict, r.reason, r.reviewed_at, e.name as reviewed_by
      from logistics.trip_visits v join logistics.trips t on t.id = v.trip_id
      left join logistics.outside_point_reviews r on r.visit_id = v.id
      left join auth.account_links l on l.account_id = r.reviewed_by_account_id and l.app_code = 'hris'
      left join hris.employees e on e.id = l.local_user_id
      where v.status = 'DELIVERED' and v.distance_m > ${radius} and (v.processed_at at time zone 'Asia/Jakarta')::date >= ${from}::date and ${reviewedWhere}
      union all
      select 'SELF', s.id, s.trip_id, st.number, s.destination_name, s.done_at, s.distance_m, array[st.employee_id],
        r.verdict, r.reason, r.reviewed_at, e.name
      from logistics.self_trip_stops s join logistics.self_trips st on st.id = s.trip_id
      left join logistics.outside_point_reviews r on r.self_stop_id = s.id
      left join auth.account_links l on l.account_id = r.reviewed_by_account_id and l.app_code = 'hris'
      left join hris.employees e on e.id = l.local_user_id
      where s.status = 'DELIVERED' and s.distance_m > ${radius} and (s.done_at at time zone 'Asia/Jakarta')::date >= ${from}::date and ${reviewedWhere}
    ) x order by done_at ${reviewed ? sql`desc` : sql`asc`} limit 300`);
}

async function settings() {
  const today = wibDate(new Date());
  const [from, radius] = await Promise.all([
    settingOn<string>('logistics.outside_review_from', today), settingOn<number>('logistics.store_radius_m', today),
  ]);
  return { today, from: String(from), radius: Number(radius) };
}

export type OutsideRow = {
  kind: OutsideKind; id: number; tripHref: string; tripNumber: string; store: string; on: IsoDate; at: string; distanceM: number; crew: string;
  days: number; red: boolean; verdict: 'OK' | 'NOT_OK' | null; reason: string | null; reviewedBy: string | null; reviewedOn: string | null; canReview: boolean;
};

/** Layar Di Luar Titik: tab Belum ditinjau (paling lama di atas) / Sudah ditinjau (30 hari). */
export async function outsideScreen(actor: Actor | null, tab: 'WAITING' | 'DONE') {
  if (!actor || !can(actor, REVIEW)) return null;
  const { today, from, radius } = await settings();
  const [rows, names] = await Promise.all([loadOutside(from, radius, tab === 'DONE'), peopleNames()]);
  return {
    radius,
    rows: rows.map((r): OutsideRow => {
      const done = new Date(r.done_at);
      const on = wibDate(done);
      const days = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${on}T00:00:00Z`)) / 86_400_000));
      const crew = (r.crew ?? []).map(Number);
      return {
        kind: r.kind, id: Number(r.id), tripHref: r.kind === 'TRUCK' ? `/logistik/trip/${r.trip_id}` : `/logistik/antar-sendiri/kantor?trip=${r.trip_id}`,
        tripNumber: r.trip_number, store: r.store, on, at: wibClock(done), distanceM: Number(r.distance_m), crew: crew.map((id) => names.get(id) ?? '-').join(', '),
        days, red: !r.verdict && days > OUTSIDE_RED_DAYS, verdict: (r.verdict as OutsideRow['verdict']) ?? null, reason: r.reason,
        reviewedBy: r.reviewed_by, reviewedOn: r.reviewed_at ? wibDate(new Date(r.reviewed_at)) : null,
        canReview: !r.verdict && !crew.includes(actor.personId),
      };
    }),
  };
}

/** Wajar / Tidak wajar (alasan wajib). Bukan awak / PJ kiriman itu. Tidak wajar memberi tahu awak/PJ dan Pemilik/GM. */
export async function reviewOutside(actor: Actor | null, kind: OutsideKind, id: number, verdict: 'OK' | 'NOT_OK', reason: string | null): Promise<ServiceResult> {
  if (!actor || !can(actor, REVIEW)) return fail(403, FORBIDDEN);
  const text = (reason ?? '').trim();
  if (verdict === 'NOT_OK') {
    const problem = reasonProblem(text);
    if (problem) return fail(400, problem);
  }
  const { from, radius } = await settings();
  const row = (await loadOutside(from, radius, null)).find((r) => r.kind === kind && Number(r.id) === id);
  if (!row) return fail(404, 'Kiriman di luar titik tidak ditemukan.');
  if (row.verdict) return fail(409, 'Kiriman ini sudah ditinjau. Muat ulang halaman.');
  const crew = (row.crew ?? []).map(Number);
  if (crew.includes(actor.personId)) return fail(403, 'Kiriman yang Anda bawa sendiri ditinjau orang lain.');
  const [crewAccounts, owners] = verdict === 'NOT_OK' ? await Promise.all([accountsOf(crew), ownerAccounts()]) : [[], []];
  try {
    return await db.transaction(async (tx) => {
      const [saved] = await tx.insert(outsidePointReviews).values({
        visitId: kind === 'TRUCK' ? id : null, selfStopId: kind === 'SELF' ? id : null, verdict, reason: text || null, reviewedByAccountId: actor.accountId,
      }).returning({ id: outsidePointReviews.id });
      if (verdict === 'NOT_OK') {
        await notify(tx, [...crewAccounts, ...owners], {
          kind: 'logistics.outside_point', title: `Kiriman di luar titik dinilai Tidak wajar: ${row.store}`,
          body: `${row.trip_number}, ${Number(row.distance_m)} m dari titik toko. Alasan: ${text}`, link: '/logistik/di-luar-titik?tab=DONE',
          entity: 'outside_point_review', entityId: saved.id,
        }, actor.accountId);
      }
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (isUniqueViolation(error, kind === 'TRUCK' ? 'outside_point_reviews_visit' : 'outside_point_reviews_self_stop')) {
      return fail(409, 'Kiriman ini sudah ditinjau. Muat ulang halaman.');
    }
    throw error;
  }
}

/** Dashboard: banyak kiriman di luar titik yang belum ditinjau, dan yang sudah lewat 3 hari. Tanpa pemeriksaan hak (pemanggil memeriksa). */
export async function outsideWaitingCounts(): Promise<{ waiting: number; red: number }> {
  const { today, from, radius } = await settings();
  const rows = await loadOutside(from, radius, false);
  const redBefore = addDays(today, -OUTSIDE_RED_DAYS);
  return { waiting: rows.length, red: rows.filter((r) => wibDate(new Date(r.done_at)) < redBefore).length };
}
