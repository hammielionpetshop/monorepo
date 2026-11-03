import { sql } from 'drizzle-orm';
import {
  boolean, check, date, doublePrecision, index, integer, pgSchema, serial, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

// Logistik Minimal (spec HRIS L6 §2, PRD 08). Tanpa foreign key ke schema lain (PRD 01 §2): id karyawan, akun,
// dan berkas disimpan sebagai angka/uuid biasa, dijaga pintu server + tes. Tidak ada yang dihapus (PRI-02):
// trigger `forbid_delete` di migrasi menolak DELETE; pembatalan = tanda.
export const logisticsSchema = pgSchema('logistics');

/** Mobil (LOG-18, 94): plat unik, hanya dinonaktifkan. */
export const vehicles = logisticsSchema.table(
  'vehicles',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    plate: text('plate').notNull(),
    active: boolean('active').notNull().default(true),
    /** Kosong = isi awal migrasi. */
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByAccountId: integer('updated_by_account_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('vehicles_plate_unique').on(sql`upper(${t.plate})`),
    check('vehicles_name_not_blank', sql`btrim(${t.name}) <> ''`),
    check('vehicles_plate_not_blank', sql`btrim(${t.plate}) <> ''`),
  ],
);

/** Rute (LOG-17, 94): jenis DELIVERY (kirim) atau SHOPPING (belanja supplier; nama = nama supplier). */
export const routes = logisticsSchema.table(
  'routes',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    active: boolean('active').notNull().default(true),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByAccountId: integer('updated_by_account_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('routes_name_unique').on(sql`lower(${t.name})`),
    check('routes_kind', sql`${t.kind} in ('DELIVERY', 'SHOPPING')`),
    check('routes_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

/**
 * Trip (LOG-21 s.d. 31 yang dibawa PRD 08). DRAFT → RUNNING (Berangkat) → DONE (Sampai Garasi / ditutup kantor);
 * DRAFT → CANCELLED. `tripDate` lahir saat Berangkat (jam server, WIB; LOG-25, KEH-122).
 */
export const trips = logisticsSchema.table(
  'trips',
  {
    id: serial('id').primaryKey(),
    /** TR-YYMMDD-n, tanggal dibuat (WIB). */
    number: text('number').notNull(),
    vehicleId: integer('vehicle_id').notNull().references(() => vehicles.id),
    /** Rute kirim; kosong = trip belanja saja (LOG-34). */
    routeId: integer('route_id').references(() => routes.id),
    status: text('status').notNull().default('DRAFT'),
    tripDate: date('trip_date', { mode: 'string' }),
    departedAt: timestamp('departed_at', { withTimezone: true }),
    departedByEmployeeId: integer('departed_by_employee_id'),
    crewPhotoFileId: uuid('crew_photo_file_id'),
    departLatitude: doublePrecision('depart_latitude'),
    departLongitude: doublePrecision('depart_longitude'),
    departAccuracyM: integer('depart_accuracy_m'),
    /** Jam trip Selesai: Sampai Garasi atau ditutup kantor. */
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    arrivedByEmployeeId: integer('arrived_by_employee_id'),
    arriveLatitude: doublePrecision('arrive_latitude'),
    arriveLongitude: doublePrecision('arrive_longitude'),
    arriveAccuracyM: integer('arrive_accuracy_m'),
    arriveDistanceM: integer('arrive_distance_m'),
    /** Sampai Garasi saat pagar uji mati (LOG-104). */
    fenceOff: boolean('fence_off').notNull().default(false),
    officeClosedByAccountId: integer('office_closed_by_account_id'),
    officeCloseReason: text('office_close_reason'),
    officeClosePhotoFileId: uuid('office_close_photo_file_id'),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** Pemberitahuan "menggantung" sudah dikirim (LOG-31), supaya sekali per trip. */
    hangingNotifiedAt: timestamp('hanging_notified_at', { withTimezone: true }),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('trips_number_unique').on(t.number),
    // Satu trip berjalan per mobil (LOG-98); per orang dijaga pintu server di bawah kunci.
    uniqueIndex('trips_one_running_per_vehicle').on(t.vehicleId).where(sql`${t.status} = 'RUNNING'`),
    index('trips_status_idx').on(t.status),
    index('trips_date_idx').on(t.tripDate),
    check('trips_status', sql`${t.status} in ('DRAFT', 'RUNNING', 'DONE', 'CANCELLED')`),
    check('trips_departed', sql`(${t.status} in ('RUNNING', 'DONE')) = (${t.departedAt} is not null and ${t.tripDate} is not null and ${t.crewPhotoFileId} is not null)`),
    check('trips_finished', sql`(${t.status} = 'DONE') = (${t.finishedAt} is not null)`),
    check('trips_cancelled', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null and ${t.cancelReason} is not null)`),
    check('trips_office_close', sql`(${t.officeClosedByAccountId} is null) = (${t.officeCloseReason} is null)`),
  ],
);

/** Awak trip (LOG-15, 22, 101; KEH-121). Dicopot = tanda, tidak dihapus. */
export const tripCrew = logisticsSchema.table(
  'trip_crew',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    employeeId: integer('employee_id').notNull(),
    role: text('role').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    addedByAccountId: integer('added_by_account_id').notNull(),
    /** Ditambahkan kantor sesudah Berangkat: absen masuk = jam ditambahkan (KEH-121). */
    addedAfterDeparture: boolean('added_after_departure').notNull().default(false),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedByAccountId: integer('removed_by_account_id'),
    removeReason: text('remove_reason'),
  },
  (t) => [
    uniqueIndex('trip_crew_person_unique').on(t.tripId, t.employeeId).where(sql`${t.removedAt} is null`),
    uniqueIndex('trip_crew_one_driver').on(t.tripId).where(sql`${t.role} = 'DRIVER' and ${t.removedAt} is null`),
    index('trip_crew_employee_idx').on(t.employeeId),
    check('trip_crew_role', sql`${t.role} in ('DRIVER', 'ASSISTANT')`),
    check('trip_crew_removed', sql`(${t.removedAt} is null) = (${t.removedByAccountId} is null)`),
  ],
);

/** Tugas belanja ke supplier dalam satu trip (LOG-34, 100). */
export const tripShopping = logisticsSchema.table(
  'trip_shopping',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    routeId: integer('route_id').notNull().references(() => routes.id),
    status: text('status').notNull().default('OPEN'),
    receiptPhotoFileId: uuid('receipt_photo_file_id'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneByEmployeeId: integer('done_by_employee_id'),
    dropReason: text('drop_reason'),
    /** Kosong saat gugur otomatis ketika trip ditutup (spec L6 §9 butir 3). */
    droppedByAccountId: integer('dropped_by_account_id'),
    droppedAt: timestamp('dropped_at', { withTimezone: true }),
    addedByAccountId: integer('added_by_account_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('trip_shopping_route_unique').on(t.tripId, t.routeId).where(sql`${t.status} <> 'DROPPED'`),
    check('trip_shopping_status', sql`${t.status} in ('OPEN', 'DONE', 'DROPPED')`),
    check('trip_shopping_done', sql`(${t.status} = 'DONE') = (${t.doneAt} is not null and ${t.receiptPhotoFileId} is not null)`),
    check('trip_shopping_dropped', sql`(${t.status} = 'DROPPED') = (${t.droppedAt} is not null and ${t.dropReason} is not null)`),
  ],
);

/**
 * Ritase (RITASE) dan upah belanja (SHOPPING) per orang (LOG-33 s.d. 36, 101, 102; DRV-14, 15). Dicatat server saat trip
 * Selesai (AUTO) atau ritase tangan Pemilik/GM (MANUAL). Tanpa nominal: tarif di L7. Batal = tanda + alasan.
 */
export const tripWages = logisticsSchema.table(
  'trip_wages',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').references(() => trips.id),
    employeeId: integer('employee_id').notNull(),
    role: text('role').notNull(),
    kind: text('kind').notNull(),
    shoppingId: integer('shopping_id').references(() => tripShopping.id),
    tripDate: date('trip_date', { mode: 'string' }).notNull(),
    vehicleId: integer('vehicle_id').notNull().references(() => vehicles.id),
    routeId: integer('route_id').notNull().references(() => routes.id),
    withAssistant: boolean('with_assistant').notNull(),
    origin: text('origin').notNull().default('AUTO'),
    manualReason: text('manual_reason'),
    /** Ritase tangan yang dikonfirmasi "Memang dua kali jalan" (LOG-102). */
    confirmedTwice: boolean('confirmed_twice').notNull().default(false),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('trip_wages_once').on(t.tripId, t.employeeId, t.kind, sql`coalesce(${t.shoppingId}, 0)`)
      .where(sql`${t.tripId} is not null and ${t.cancelledAt} is null`),
    index('trip_wages_person_date_idx').on(t.employeeId, t.tripDate),
    index('trip_wages_date_idx').on(t.tripDate),
    check('trip_wages_role', sql`${t.role} in ('DRIVER', 'ASSISTANT')`),
    check('trip_wages_kind', sql`${t.kind} in ('RITASE', 'SHOPPING')`),
    check('trip_wages_origin', sql`${t.origin} in ('AUTO', 'MANUAL')`),
    check('trip_wages_auto_has_trip', sql`(${t.origin} = 'AUTO') = (${t.tripId} is not null)`),
    check('trip_wages_manual_reason', sql`(${t.origin} = 'MANUAL') = (${t.manualReason} is not null)`),
    check('trip_wages_shopping', sql`${t.kind} <> 'SHOPPING' or ${t.origin} = 'MANUAL' or ${t.shoppingId} is not null`),
    check('trip_wages_cancel', sql`(${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

/** Pagar uji (LOG-32, 104): pemeriksaan titik Gudang saat Sampai Garasi dimatikan sementara, paling lama 24 jam. */
export const fenceOverrides = logisticsSchema.table(
  'fence_overrides',
  {
    id: serial('id').primaryKey(),
    reason: text('reason').notNull(),
    fromAt: timestamp('from_at', { withTimezone: true }).notNull().defaultNow(),
    untilAt: timestamp('until_at', { withTimezone: true }).notNull(),
    byAccountId: integer('by_account_id').notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByAccountId: integer('ended_by_account_id'),
  },
  (t) => [
    check('fence_overrides_max_24h', sql`${t.untilAt} > ${t.fromAt} and ${t.untilAt} <= ${t.fromAt} + interval '24 hours'`),
    check('fence_overrides_reason', sql`btrim(${t.reason}) <> ''`),
  ],
);

/** Setiap pembukaan foto awak / nota / tutup kantor dicatat (KEH-20). */
export const photoViews = logisticsSchema.table(
  'photo_views',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    fileId: uuid('file_id').notNull(),
    viewedByAccountId: integer('viewed_by_account_id').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('photo_views_trip_idx').on(t.tripId)],
);

/** Foto awak yang isinya sudah dibuang lewat masa simpan (KEH-15). */
export const photoPurges = logisticsSchema.table('photo_purges', {
  fileId: uuid('file_id').primaryKey(),
  purgedAt: timestamp('purged_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Pengaturan Logistik yang bukan bertanggal: cabang titik garasi (spec L6 §3.9). Satu baris. */
export const config = logisticsSchema.table(
  'config',
  {
    id: integer('id').primaryKey().default(1),
    /** Cabang HRIS yang titik + radiusnya dipakai Sampai Garasi. Kosong = belum diatur (Sampai Garasi ditolak). */
    garageBranchId: integer('garage_branch_id'),
    updatedByAccountId: integer('updated_by_account_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [check('config_single_row', sql`${t.id} = 1`)],
);
