import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export type LogisticsQueueAges = {
  /** Surat jalan / antar sendiri Gagal belum diputuskan lebih dari 3 hari (B50). */
  failedOld: number; failedOldestAt: string | null;
  /** Laporan toko belum diputuskan lebih dari 3 hari (B51/B52). */
  reportsOld: number; reportsOldestAt: string | null;
  /** Titik toko Menunggu lebih dari 2 hari (B46). */
  pointsOld: number; pointsOldestAt: string | null;
  /** Permintaan bensin belum diisi sampai 12.00 hari berikutnya (B54). */
  fuelDue: number; fuelOldestAt: string | null;
};

const iso = (value: string | Date | null) => (value ? new Date(value).toISOString() : null);

/**
 * Umur tindak lanjut Logistik untuk antrean berantai (spec F3-4 §3.1): kartu Beranda sudah tampil sejak awal,
 * jendelanya baru muncul sesudah umur ini. Tanpa pemeriksaan hak; dipakai bersama kartu yang sudah memeriksa hak.
 */
export async function logisticsQueueAges(): Promise<LogisticsQueueAges> {
  const [row] = await db.execute<{
    failed_old: number; failed_oldest: string | null; reports_old: number; reports_oldest: string | null;
    points_old: number; points_oldest: string | null; fuel_due: number; fuel_oldest: string | null;
  }>(sql`
    with failed as (
      select coalesce(n.updated_at, n.created_at) as at from logistics.delivery_notes n where n.status = 'NEEDS_DECISION'
      union all
      select coalesce(x.done_at, t.started_at) from logistics.self_trip_stops x join logistics.self_trips t on t.id = x.trip_id
      where x.status = 'FAILED' and x.decision is null
    )
    select
      (select count(*)::int from failed where at < now() - interval '3 days') as failed_old,
      (select min(at) from failed where at < now() - interval '3 days') as failed_oldest,
      (select count(*)::int from logistics.visit_reports where closed_at is null and reported_at < now() - interval '3 days') as reports_old,
      (select min(reported_at) from logistics.visit_reports where closed_at is null and reported_at < now() - interval '3 days') as reports_oldest,
      (select count(*)::int from logistics.store_points where status = 'PENDING' and proposed_at < now() - interval '2 days') as points_old,
      (select min(proposed_at) from logistics.store_points where status = 'PENDING' and proposed_at < now() - interval '2 days') as points_oldest,
      (select count(*)::int from logistics.trip_end_reports where needs_fuel and fuel_closed_at is null
        and ((sent_at at time zone 'Asia/Jakarta')::date + 1 + time '12:00') <= (now() at time zone 'Asia/Jakarta')) as fuel_due,
      (select min(sent_at) from logistics.trip_end_reports where needs_fuel and fuel_closed_at is null
        and ((sent_at at time zone 'Asia/Jakarta')::date + 1 + time '12:00') <= (now() at time zone 'Asia/Jakarta')) as fuel_oldest`);
  return {
    failedOld: Number(row?.failed_old ?? 0), failedOldestAt: iso(row?.failed_oldest ?? null),
    reportsOld: Number(row?.reports_old ?? 0), reportsOldestAt: iso(row?.reports_oldest ?? null),
    pointsOld: Number(row?.points_old ?? 0), pointsOldestAt: iso(row?.points_oldest ?? null),
    fuelDue: Number(row?.fuel_due ?? 0), fuelOldestAt: iso(row?.fuel_oldest ?? null),
  };
}
