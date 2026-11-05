import { sql } from 'drizzle-orm';
import {
  boolean, check, date, doublePrecision, index, integer, numeric, pgSchema, serial, text, timestamp, uniqueIndex, uuid,
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
    /** Siap Kirim (spec LT1 §13.3 butir 1): ditekan kantor selagi Draft; kosong = Draft biasa. */
    readyAt: timestamp('ready_at', { withTimezone: true }),
    readyByAccountId: integer('ready_by_account_id'),
    /** Menuju Garasi (§13.3 butir 3, 4): foto bak kosong, atau Selesai lebih awal dengan alasan. */
    headingHomeAt: timestamp('heading_home_at', { withTimezone: true }),
    headingHomeByEmployeeId: integer('heading_home_by_employee_id'),
    emptyBedPhotoFileId: uuid('empty_bed_photo_file_id'),
    earlyFinishReason: text('early_finish_reason'),
    /** Foto amper bensin saat Sampai Garasi (§13.3 butir 5). */
    fuelGaugePhotoFileId: uuid('fuel_gauge_photo_file_id'),
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
    check('trips_ready', sql`(${t.readyAt} is null) = (${t.readyByAccountId} is null)`),
    check('trips_heading_home', sql`(${t.headingHomeAt} is null) = (${t.emptyBedPhotoFileId} is null) and (${t.headingHomeAt} is null or ${t.status} in ('RUNNING', 'DONE'))`),
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

/**
 * Tarif ritase & upah belanja per pasangan mobil + rute, bertanggal (spec L7 §3.1; DRV-08, 10 s.d. 13). Tiga angka:
 * driver ada kenek, driver tanpa kenek, kenek. Tidak dihapus (DRV-12): yang belum berlaku boleh CANCELLED; salah ketik
 * = baris lama FIXED + baris betulan (`fixesId`) pada tanggal berlaku yang sama (U4). Rupiahnya ditulis modul Gaji.
 */
export const tripRates = logisticsSchema.table(
  'trip_rates',
  {
    id: serial('id').primaryKey(),
    vehicleId: integer('vehicle_id').notNull().references(() => vehicles.id),
    routeId: integer('route_id').notNull().references(() => routes.id),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    driverWithAssistant: integer('driver_with_assistant').notNull(),
    driverAlone: integer('driver_alone').notNull(),
    assistant: integer('assistant').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    /** Baris salah ketik yang dibetulkan oleh baris ini. */
    fixesId: integer('fixes_id'),
    /** Alasan betulkan salah ketik. */
    reason: text('reason'),
    /** Kosong = isi awal migrasi. */
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endedByAccountId: integer('ended_by_account_id'),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endReason: text('end_reason'),
  },
  (t) => [
    uniqueIndex('trip_rates_active_unique').on(t.vehicleId, t.routeId, t.effectiveFrom).where(sql`${t.status} = 'ACTIVE'`),
    index('trip_rates_pair_idx').on(t.vehicleId, t.routeId),
    check('trip_rates_status', sql`${t.status} in ('ACTIVE', 'CANCELLED', 'FIXED')`),
    check('trip_rates_amounts', sql`${t.driverWithAssistant} >= 0 and ${t.driverAlone} >= 0 and ${t.assistant} >= 0`),
    check('trip_rates_fix_reason', sql`(${t.fixesId} is null) = (${t.reason} is null)`),
    check('trip_rates_ended', sql`(${t.status} = 'ACTIVE') = (${t.endedAt} is null)`),
  ],
);

/**
 * Data pengiriman toko (spec LT1 §2.3, §12). Toko = pelanggan kasir (`petshop.customers.id`, angka biasa tanpa foreign key);
 * nama, HP, alamat tetap di kasir. Baris dibuat saat pertama diisi; tidak dihapus (kosongkan isinya).
 */
export const stores = logisticsSchema.table(
  'stores',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id').notNull(),
    /** Rute kirim bawaan (LOG-06); kosong = belum ditentukan. */
    defaultRouteId: integer('default_route_id').references(() => routes.id),
    /** Catatan pengiriman untuk driver (patokan, jam buka, dsb.). */
    deliveryNote: text('delivery_note'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedByAccountId: integer('updated_by_account_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('stores_customer_unique').on(t.customerId),
    check('stores_note_length', sql`${t.deliveryNote} is null or char_length(${t.deliveryNote}) <= 500`),
  ],
);

/**
 * Titik toko (spec LT1 §3.8, §13.4): dipasang awak dari kunjungan (GPS + foto depan toko) atau ditempel kantor. Satu toko
 * paling banyak satu titik Disetujui dan satu usulan Menunggu. Riwayat tidak dihapus; titik lama menjadi Diganti.
 */
export const storePoints = logisticsSchema.table(
  'store_points',
  {
    id: serial('id').primaryKey(),
    customerId: integer('customer_id').notNull(),
    /** PENDING (Menunggu), APPROVED (Disetujui), REJECTED (Ditolak), REPLACED (Diganti titik yang lebih baru). */
    status: text('status').notNull(),
    /** VISIT = dari kunjungan trip; OFFICE = koordinat ditempel kantor. */
    source: text('source').notNull(),
    /** NEW = toko belum punya titik; CORRECTION = Laporkan titik salah (alasan wajib). */
    kind: text('kind').notNull(),
    reason: text('reason'),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    accuracyM: integer('accuracy_m'),
    photoFileId: uuid('photo_file_id'),
    tripId: integer('trip_id').references(() => trips.id),
    visitId: integer('visit_id').references(() => tripVisits.id),
    /** Dipasang pengantar antar sendiri (spec LT1 §15.2). */
    selfStopId: integer('self_stop_id').references(() => selfTripStops.id),
    proposedByEmployeeId: integer('proposed_by_employee_id'),
    proposedByAccountId: integer('proposed_by_account_id').notNull(),
    proposedAt: timestamp('proposed_at', { withTimezone: true }).notNull().defaultNow(),
    decidedByAccountId: integer('decided_by_account_id'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    rejectReason: text('reject_reason'),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('store_points_one_approved').on(t.customerId).where(sql`${t.status} = 'APPROVED'`),
    uniqueIndex('store_points_one_pending').on(t.customerId).where(sql`${t.status} = 'PENDING'`),
    index('store_points_customer_idx').on(t.customerId),
    check('store_points_status', sql`${t.status} in ('PENDING', 'APPROVED', 'REJECTED', 'REPLACED')`),
    check('store_points_source', sql`${t.source} in ('VISIT', 'OFFICE') and (${t.source} = 'VISIT') = (${t.photoFileId} is not null and (${t.tripId} is not null or ${t.selfStopId} is not null))`),
    check('store_points_kind', sql`${t.kind} in ('NEW', 'CORRECTION') and (${t.kind} = 'NEW' or ${t.reason} is not null)`),
    check('store_points_decided', sql`(${t.status} = 'PENDING') = (${t.decidedAt} is null) and (${t.status} = 'REJECTED') = (${t.rejectReason} is not null)`),
    check('store_points_replaced', sql`(${t.status} = 'REPLACED') = (${t.replacedAt} is not null)`),
    check('store_points_coordinates', sql`abs(${t.latitude}) <= 90 and abs(${t.longitude}) <= 180 and not (${t.latitude} = 0 and ${t.longitude} = 0)`),
  ],
);

/**
 * Surat jalan (spec LT1 §2.3, §3.3): nota (`SALE`) atau PO Internal (`TRANSFER`) bertanda truk Gudang. Baris dibuat saat
 * pertama disentuh (masuk trip); sebelumnya "Menunggu" dibaca langsung dari view kasir. `docId` = id dokumen kasir.
 */
export const deliveryNotes = logisticsSchema.table(
  'delivery_notes',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').notNull(),
    docId: integer('doc_id').notNull(),
    number: text('number').notNull(),
    /** Cabang kasir asal (`petshop.branches.id`). */
    originBranchId: integer('origin_branch_id').notNull(),
    /** Tujuan: pelanggan (nota) atau cabang kasir (PO Internal). */
    customerId: integer('customer_id'),
    destinationBranchId: integer('destination_branch_id'),
    status: text('status').notNull().default('WAITING'),
    /** Berapa kali Kirim Besok / dikembalikan karena trip ditutup (tanda "pernah tertunda ×n"). */
    tomorrowCount: integer('tomorrow_count').notNull().default(0),
    /** Nominal kasir saat terakhir masuk trip, pembanding "berubah di kasir". */
    amountAtTrip: integer('amount_at_trip'),
    revisionAtTrip: integer('revision_at_trip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('delivery_notes_doc_unique').on(t.kind, t.docId),
    index('delivery_notes_status_idx').on(t.status),
    check('delivery_notes_kind', sql`${t.kind} in ('SALE', 'TRANSFER')`),
    check('delivery_notes_status', sql`${t.status} in ('WAITING', 'ON_TRIP', 'DELIVERED', 'NEEDS_DECISION', 'CANCELLED')`),
    check('delivery_notes_destination', sql`(${t.kind} = 'SALE') = (${t.customerId} is not null) and (${t.kind} = 'TRANSFER') = (${t.destinationBranchId} is not null)`),
  ],
);

/** Langkah "Ambil barang di [cabang]" (spec LT1 §3.5): satu per cabang asal selain Gudang per trip. */
export const tripPickups = logisticsSchema.table(
  'trip_pickups',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    originBranchId: integer('origin_branch_id').notNull(),
    originName: text('origin_name').notNull(),
    /** OPEN → DONE (foto barang diterima driver) / NOT_READY (belum siap, alasan) / DROPPED (tak ada surat jalan lagi). */
    status: text('status').notNull().default('OPEN'),
    photoFileId: uuid('photo_file_id'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneByEmployeeId: integer('done_by_employee_id'),
    reason: text('reason'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('trip_pickups_origin_unique').on(t.tripId, t.originBranchId).where(sql`${t.status} in ('OPEN', 'DONE')`),
    check('trip_pickups_status', sql`${t.status} in ('OPEN', 'DONE', 'NOT_READY', 'DROPPED')`),
    check('trip_pickups_done', sql`(${t.status} = 'DONE') = (${t.doneAt} is not null and ${t.photoFileId} is not null)`),
  ],
);

/** Kunjungan (spec LT1 §3.3, §3.6): satu tujuan per trip, berisi satu atau lebih surat jalan. */
export const tripVisits = logisticsSchema.table(
  'trip_visits',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    customerId: integer('customer_id'),
    destinationBranchId: integer('destination_branch_id'),
    destinationName: text('destination_name').notNull(),
    /** OPEN; DELIVERED / TOMORROW / FAILED (diproses awak, LT1b-2); RELEASED (dilepas kantor / trip Draft diubah). */
    status: text('status').notNull().default('OPEN'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processedByEmployeeId: integer('processed_by_employee_id'),
    reason: text('reason'),
    /** Alasan baku Kirim Besok / Gagal (§13.3 butir 2). */
    reasonCode: text('reason_code'),
    photoFileId: uuid('photo_file_id'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    accuracyM: integer('accuracy_m'),
    /** Jarak lokasi Terkirim dari titik toko Disetujui saat itu (spec LT1 §13.4 butir 5); hanya dicatat. */
    distanceM: integer('distance_m'),
    releasedByAccountId: integer('released_by_account_id'),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('trip_visits_destination_unique').on(t.tripId, sql`coalesce(${t.customerId}, 0)`, sql`coalesce(${t.destinationBranchId}, 0)`)
      .where(sql`${t.status} = 'OPEN'`),
    index('trip_visits_trip_idx').on(t.tripId),
    check('trip_visits_status', sql`${t.status} in ('OPEN', 'DELIVERED', 'TOMORROW', 'FAILED', 'RELEASED')`),
    check('trip_visits_destination', sql`(${t.customerId} is null) <> (${t.destinationBranchId} is null)`),
    check('trip_visits_released', sql`(${t.status} = 'RELEASED') = (${t.releasedAt} is not null)`),
  ],
);

/**
 * Cara bayar di toko saat Terkirim (spec LT1 §13.2, §13.5): satu yang berlaku per kunjungan, dicatat awak bersama Terkirim. Uang
 * disimpan rupiah bulat. Tidak dihapus; koreksi salah tekan (spec LT1 §14.2 butir 4) menulis baris baru dan menandai baris lama
 * Diganti (`replaced_at`).
 */
export const visitPayments = logisticsSchema.table(
  'visit_payments',
  {
    id: serial('id').primaryKey(),
    visitId: integer('visit_id').notNull().references(() => tripVisits.id),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    customerId: integer('customer_id').notNull(),
    /** NONE (tidak ada tagihan, lunas di kasir), CASH, TRANSFER, PARTIAL (bayar sebagian / titip cash), TEMPO. */
    method: text('method').notNull(),
    /** Sisa piutang kasir nota-nota kunjungan saat Terkirim. */
    billAmount: integer('bill_amount').notNull(),
    receivedAmount: integer('received_amount').notNull(),
    proofPhotoFileId: uuid('proof_photo_file_id'),
    recordedByEmployeeId: integer('recorded_by_employee_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    /** Janji bayar sisa (spec LT1 §14.2 butir 5; LOG-113): wajib untuk Bayar sebagian / Tempo sejak LT2b; baris lama kosong. */
    promiseDate: date('promise_date', { mode: 'string' }),
    /** Koreksi (§14.2 butir 4): baris yang dikoreksi + alasan; akun pengoreksi (awak atau kantor). */
    correctionOfId: integer('correction_of_id'),
    correctionReason: text('correction_reason'),
    recordedByAccountId: integer('recorded_by_account_id'),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('visit_payments_visit_current').on(t.visitId).where(sql`${t.replacedAt} is null`),
    index('visit_payments_trip_idx').on(t.tripId),
    check('visit_payments_method', sql`${t.method} in ('NONE', 'CASH', 'TRANSFER', 'PARTIAL', 'TEMPO')`),
    check('visit_payments_amounts', sql`${t.billAmount} >= 0 and ${t.receivedAmount} >= 0 and (
      (${t.method} = 'NONE' and ${t.billAmount} = 0 and ${t.receivedAmount} = 0)
      or (${t.method} in ('CASH', 'TRANSFER') and ${t.billAmount} > 0 and ${t.receivedAmount} = ${t.billAmount})
      or (${t.method} = 'PARTIAL' and ${t.receivedAmount} > 0 and ${t.receivedAmount} < ${t.billAmount})
      or (${t.method} = 'TEMPO' and ${t.billAmount} > 0 and ${t.receivedAmount} = 0))`),
    check('visit_payments_proof', sql`(${t.method} = 'TRANSFER') = (${t.proofPhotoFileId} is not null)`),
    check('visit_payments_promise', sql`${t.promiseDate} is null or ${t.method} in ('PARTIAL', 'TEMPO')`),
    check('visit_payments_correction', sql`(${t.correctionOfId} is null) = (${t.correctionReason} is null)`),
  ],
);

/**
 * Laporan kunjungan sesudah Terkirim (spec LT1 §13.2, §13.5): pilihan baku + foto + catatan. Kantor memutuskan potong
 * nota di Back Office lalu menutupnya dengan catatan. Retur dibawa pulang driver. Tidak dihapus.
 */
export const visitReports = logisticsSchema.table(
  'visit_reports',
  {
    id: serial('id').primaryKey(),
    /** Sumber: kunjungan trip truk (visit + trip), atau tujuan antar sendiri (self stop + self trip, spec LT1 §15.4). */
    visitId: integer('visit_id').references(() => tripVisits.id),
    tripId: integer('trip_id').references(() => trips.id),
    selfStopId: integer('self_stop_id').references(() => selfTripStops.id),
    selfTripId: integer('self_trip_id').references(() => selfTrips.id),
    /** Kosong hanya untuk tujuan antar sendiri nota Umum. */
    customerId: integer('customer_id'),
    /** WRONG_ITEM, SHORT, DAMAGED, PRICE (harga beda, LT2b), RETURN, OTHER. */
    kind: text('kind').notNull(),
    note: text('note'),
    photoFileId: uuid('photo_file_id').notNull(),
    carriedBack: boolean('carried_back').notNull().default(false),
    /** Cabang kasir pemilik barang retur (spec LT1 §14.1 butir 2); kosong = laporan lama / bukan retur (dianggap Gudang). */
    ownerBranchId: integer('owner_branch_id'),
    reportedByEmployeeId: integer('reported_by_employee_id').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByAccountId: integer('closed_by_account_id'),
    closeNote: text('close_note'),
  },
  (t) => [
    index('visit_reports_visit_idx').on(t.visitId),
    index('visit_reports_self_stop_idx').on(t.selfStopId),
    index('visit_reports_open_idx').on(t.closedAt),
    check('visit_reports_source', sql`(${t.visitId} is not null and ${t.tripId} is not null and ${t.customerId} is not null and ${t.selfStopId} is null and ${t.selfTripId} is null)
      or (${t.visitId} is null and ${t.tripId} is null and ${t.selfStopId} is not null and ${t.selfTripId} is not null)`),
    check('visit_reports_kind', sql`${t.kind} in ('WRONG_ITEM', 'SHORT', 'DAMAGED', 'PRICE', 'RETURN', 'OTHER') and (${t.kind} not in ('OTHER', 'PRICE') or ${t.note} is not null)`),
    check('visit_reports_carried', sql`${t.carriedBack} = (${t.kind} = 'RETURN')`),
    check('visit_reports_closed', sql`(${t.closedAt} is null) = (${t.closeNote} is null) and (${t.closedAt} is null) = (${t.closedByAccountId} is null)`),
  ],
);

/** Kunjungan ↔ surat jalan. Satu surat jalan hanya di satu kunjungan terbuka (`active`). */
export const tripVisitNotes = logisticsSchema.table(
  'trip_visit_notes',
  {
    id: serial('id').primaryKey(),
    visitId: integer('visit_id').notNull().references(() => tripVisits.id),
    noteId: integer('note_id').notNull().references(() => deliveryNotes.id),
    active: boolean('active').notNull().default(true),
    addedByAccountId: integer('added_by_account_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('trip_visit_notes_one_open').on(t.noteId).where(sql`${t.active}`),
    index('trip_visit_notes_visit_idx').on(t.visitId),
    check('trip_visit_notes_ended', sql`${t.active} = (${t.endedAt} is null)`),
  ],
);

/** Riwayat surat jalan (spec LT1 §2.3): masuk trip, dilepas, kembali menunggu, dst. Tidak dihapus. */
export const deliveryNoteEvents = logisticsSchema.table(
  'delivery_note_events',
  {
    id: serial('id').primaryKey(),
    noteId: integer('note_id').notNull().references(() => deliveryNotes.id),
    kind: text('kind').notNull(),
    tripId: integer('trip_id').references(() => trips.id),
    reason: text('reason'),
    byAccountId: integer('by_account_id'),
    byEmployeeId: integer('by_employee_id'),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('delivery_note_events_note_idx').on(t.noteId),
    check('delivery_note_events_kind', sql`${t.kind} in ('ON_TRIP', 'RELEASED', 'TRIP_CANCELLED', 'TRIP_CLOSED', 'LOADED', 'NOT_READY', 'DELIVERED', 'TOMORROW', 'FAILED', 'RETRY', 'RESENT', 'DROPPED', 'REOPENED', 'PENDING_CLOSED', 'KASIR_CHANGED', 'KASIR_KEPT')`),
  ],
);

/**
 * Nota berubah / dibatalkan di kasir sesudah masuk trip (spec LT1 §14.3): satu baris per keadaan kasir yang berbeda dari
 * saat masuk trip, ditemukan pemeriksa berkala `logistics-kasir-check`. Diubah lagi di kasir = baris baru (diberi tahu
 * lagi). Tetap antar = `keptAt`; kasir kembali seperti semula / surat jalan lepas dari trip = `clearedAt`. Tidak dihapus.
 */
export const kasirChanges = logisticsSchema.table(
  'kasir_changes',
  {
    id: serial('id').primaryKey(),
    noteId: integer('note_id').notNull().references(() => deliveryNotes.id),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    /** CHANGED = nominal/revisi berubah, PENDING_CANCEL = menunggu batal, CANCELLED = dibatalkan di kasir. */
    kind: text('kind').notNull(),
    /** Penanda keadaan kasir (jenis + nominal + revisi): satu pemberitahuan per keadaan. */
    signature: text('signature').notNull(),
    fromAmount: integer('from_amount'),
    toAmount: integer('to_amount'),
    revision: integer('revision'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    keptAt: timestamp('kept_at', { withTimezone: true }),
    keptByAccountId: integer('kept_by_account_id'),
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('kasir_changes_once').on(t.noteId, t.tripId, t.signature),
    index('kasir_changes_open_idx').on(t.tripId).where(sql`${t.keptAt} is null and ${t.clearedAt} is null`),
    check('kasir_changes_kind', sql`${t.kind} in ('CHANGED', 'PENDING_CANCEL', 'CANCELLED')`),
    check('kasir_changes_kept', sql`(${t.keptAt} is null) = (${t.keptByAccountId} is null) and (${t.keptAt} is null or ${t.kind} <> 'CANCELLED')`),
  ],
);

/**
 * Laporan Pulang trip (spec LT1 §13.3 butir 5, 6; KEH-94, 100): satu per trip, diisi driver sesudah Sampai Garasi.
 * Tindak lanjut bensin dan keadaan mobil ditutup Kepala Gudang / Finance (tanpa Buku Kas). Tidak dihapus.
 */
export const tripEndReports = logisticsSchema.table(
  'trip_end_reports',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    vehicleId: integer('vehicle_id').notNull().references(() => vehicles.id),
    employeeId: integer('employee_id').notNull(),
    /** GOOD = Baik, ATTENTION = Perlu perhatian. */
    condition: text('condition').notNull(),
    conditionNote: text('condition_note'),
    conditionPhotoFileId: uuid('condition_photo_file_id'),
    needsFuel: boolean('needs_fuel').notNull(),
    fuelEstimate: integer('fuel_estimate'),
    problemNote: text('problem_note'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    /** FILLED = Sudah diisi, REPLACED = digantikan laporan baru mobil yang sama. */
    fuelCloseKind: text('fuel_close_kind'),
    fuelClosedAt: timestamp('fuel_closed_at', { withTimezone: true }),
    fuelClosedByAccountId: integer('fuel_closed_by_account_id'),
    conditionClosedAt: timestamp('condition_closed_at', { withTimezone: true }),
    conditionClosedByAccountId: integer('condition_closed_by_account_id'),
    conditionCloseNote: text('condition_close_note'),
  },
  (t) => [
    uniqueIndex('trip_end_reports_trip_unique').on(t.tripId),
    index('trip_end_reports_vehicle_idx').on(t.vehicleId),
    check('trip_end_reports_condition', sql`${t.condition} in ('GOOD', 'ATTENTION') and (${t.condition} = 'ATTENTION') = (${t.conditionNote} is not null)`),
    check('trip_end_reports_fuel', sql`${t.needsFuel} = (${t.fuelEstimate} is not null) and (${t.fuelEstimate} is null or ${t.fuelEstimate} > 0)`),
    check('trip_end_reports_fuel_close', sql`(${t.fuelClosedAt} is null) = (${t.fuelCloseKind} is null) and (${t.fuelClosedAt} is null or ${t.needsFuel})`),
    check('trip_end_reports_condition_close', sql`${t.conditionClosedAt} is null or ${t.condition} = 'ATTENTION'`),
  ],
);

/** Rincian barang retur yang dibawa pulang (spec LT1 §14.1 butir 2): nama + jumlah + satuan, diketik awak. Tidak dihapus. */
export const visitReportItems = logisticsSchema.table(
  'visit_report_items',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => visitReports.id),
    name: text('name').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 2 }).notNull(),
    unit: text('unit').notNull(),
  },
  (t) => [
    index('visit_report_items_report_idx').on(t.reportId),
    check('visit_report_items_name', sql`char_length(btrim(${t.name})) between 2 and 120`),
    check('visit_report_items_unit', sql`char_length(btrim(${t.unit})) between 1 and 20`),
    check('visit_report_items_quantity', sql`${t.quantity} > 0`),
  ],
);

/**
 * Penerimaan barang kembali (spec LT1 §14.1 butir 1): barang yang ikut pulang di truk (surat jalan Kirim Besok / Gagal,
 * retur dibawa pulang) diterima di Gudang, lalu, bila milik cabang lain, di cabang pemiliknya. Satu baris per sumber per
 * langkah; sumber NOTE = `trip_visit_notes.id`, RETURN = `visit_reports.id`. Tidak diubah atau dihapus.
 */
export const goodsReceipts = logisticsSchema.table(
  'goods_receipts',
  {
    id: serial('id').primaryKey(),
    sourceKind: text('source_kind').notNull(),
    sourceId: integer('source_id').notNull(),
    tripId: integer('trip_id').notNull().references(() => trips.id),
    /** WAREHOUSE = diterima di Gudang; OWNER = diterima cabang pemilik barang. */
    step: text('step').notNull(),
    /** MATCH = Sesuai; MISMATCH = Tidak sesuai (catatan wajib). */
    result: text('result').notNull(),
    note: text('note'),
    photoFileId: uuid('photo_file_id').notNull(),
    receivedByAccountId: integer('received_by_account_id').notNull(),
    receivedByEmployeeId: integer('received_by_employee_id'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('goods_receipts_once').on(t.sourceKind, t.sourceId, t.step),
    index('goods_receipts_trip_idx').on(t.tripId),
    check('goods_receipts_source', sql`${t.sourceKind} in ('NOTE', 'RETURN')`),
    check('goods_receipts_step', sql`${t.step} in ('WAREHOUSE', 'OWNER')`),
    check('goods_receipts_result', sql`${t.result} in ('MATCH', 'MISMATCH') and (${t.result} = 'MATCH' or ${t.note} is not null)`),
  ],
);

/**
 * Keputusan potong nota atas laporan toko (spec LT1 §14.2 butir 1, 3): Potong nota (nota + nominal + alasan), Retur dicatat
 * di Back Office (nilai tidak di HRIS), atau Tidak dipotong. Satu yang berlaku per laporan; ubah keputusan menulis baris baru
 * dan menandai yang lama Diganti. Potong nota / Retur BO masuk daftar "Perlu dicatat di kasir" sampai Finance menandai Sudah
 * dicatat (nomor referensi); sesudah itu terkunci. Tidak dihapus.
 */
export const reportDecisions = logisticsSchema.table(
  'report_decisions',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => visitReports.id),
    /** CUT = Potong nota, RETURN_BO = dicatat lewat Retur Back Office, NO_CUT = Tidak dipotong. */
    decision: text('decision').notNull(),
    /** Surat jalan nota yang dipotong / diretur (`delivery_notes.id`, jenis SALE). */
    noteId: integer('note_id').references(() => deliveryNotes.id),
    /** Nota kasir laporan antar sendiri (`self_trip_stops.transaction_id`; spec LT1 §15.4); laporan truk memakai `note_id`. */
    transactionId: integer('transaction_id'),
    amount: integer('amount'),
    /** WRONG_ITEM, SHORT, DAMAGED, PRICE, REJECTED, OTHER (hanya CUT). */
    reason: text('reason'),
    note: text('note'),
    decidedByAccountId: integer('decided_by_account_id').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
    /** Ubah keputusan: alasan di baris baru; baris lama Diganti. */
    changeReason: text('change_reason'),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }),
    recordedByAccountId: integer('recorded_by_account_id'),
    recordedRef: text('recorded_ref'),
  },
  (t) => [
    uniqueIndex('report_decisions_current').on(t.reportId).where(sql`${t.replacedAt} is null`),
    index('report_decisions_unrecorded_idx').on(t.recordedAt),
    check('report_decisions_decision', sql`${t.decision} in ('CUT', 'RETURN_BO', 'NO_CUT')`),
    check('report_decisions_cut', sql`(${t.decision} = 'CUT') = (${t.amount} is not null and ${t.reason} is not null)
      and (${t.amount} is null or ${t.amount} > 0)
      and (${t.reason} is null or ${t.reason} in ('WRONG_ITEM', 'SHORT', 'DAMAGED', 'PRICE', 'REJECTED', 'OTHER'))
      and (${t.decision} = 'NO_CUT' or ${t.noteId} is not null or ${t.transactionId} is not null)
      and (${t.noteId} is null or ${t.transactionId} is null)
      and (${t.decision} <> 'NO_CUT' or ${t.note} is not null)`),
    check('report_decisions_recorded', sql`(${t.recordedAt} is null) = (${t.recordedByAccountId} is null) and (${t.recordedAt} is null) = (${t.recordedRef} is null)
      and (${t.recordedAt} is null or ${t.decision} <> 'NO_CUT')`),
  ],
);

/**
 * Laporan Muat (spec LT1 §15.1, LT3a): bukti foto barang yang dimuat di cabang (Toko Pusat) untuk menjawab komplain.
 * Hanya bukti: tidak menahan trip/antar dan tidak mengubah kasir. Toko = pelanggan nota kasir yang dipilih.
 * DRAFT = Proses (foto boleh ditambah/dibuang), DONE = Selesai (terkunci, hanya foto susulan), CANCELLED = Batal (alasan).
 */
export const loadReports = logisticsSchema.table(
  'load_reports',
  {
    id: serial('id').primaryKey(),
    /** Cabang HRIS pembuat laporan (`hris.branches.id`). */
    branchId: integer('branch_id').notNull(),
    /** Cabang kasir asal nota (`petshop.branches.id`). */
    kasirBranchId: integer('kasir_branch_id').notNull(),
    customerId: integer('customer_id').notNull(),
    status: text('status').notNull().default('DRAFT'),
    createdByEmployeeId: integer('created_by_employee_id'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneByAccountId: integer('done_by_account_id'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('load_reports_branch_idx').on(t.branchId, t.createdAt),
    index('load_reports_customer_idx').on(t.customerId),
    check('load_reports_status', sql`${t.status} in ('DRAFT', 'DONE', 'CANCELLED')`),
    check('load_reports_done', sql`(${t.status} = 'DONE') = (${t.doneAt} is not null) and (${t.doneAt} is null) = (${t.doneByAccountId} is null)`),
    check('load_reports_cancelled', sql`(${t.status} = 'CANCELLED') = (${t.cancelledAt} is not null)
      and (${t.cancelledAt} is null) = (${t.cancelledByAccountId} is null) and (${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

/** Nota kasir di laporan muat. Satu nota hanya di satu laporan yang berlaku; dilepas (Proses / Batal) = `released_at`. */
export const loadReportNotes = logisticsSchema.table(
  'load_report_notes',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => loadReports.id),
    transactionId: integer('transaction_id').notNull(),
    trxNumber: text('trx_number').notNull(),
    /** Nominal kasir saat nota dipilih. */
    amount: integer('amount').notNull(),
    addedByAccountId: integer('added_by_account_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    releasedByAccountId: integer('released_by_account_id'),
  },
  (t) => [
    uniqueIndex('load_report_notes_once').on(t.transactionId).where(sql`${t.releasedAt} is null`),
    index('load_report_notes_report_idx').on(t.reportId),
    check('load_report_notes_released', sql`(${t.releasedAt} is null) = (${t.releasedByAccountId} is null)`),
  ],
);

/** Foto laporan muat: NOTE = foto nota, GOODS = foto barang. Dibuang hanya selama Proses (`removed_at`); susulan = sesudah Selesai. */
export const loadReportPhotos = logisticsSchema.table(
  'load_report_photos',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => loadReports.id),
    kind: text('kind').notNull(),
    fileId: uuid('file_id').notNull(),
    late: boolean('late').notNull().default(false),
    takenByEmployeeId: integer('taken_by_employee_id'),
    takenByAccountId: integer('taken_by_account_id').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedByAccountId: integer('removed_by_account_id'),
  },
  (t) => [
    index('load_report_photos_report_idx').on(t.reportId),
    uniqueIndex('load_report_photos_file_unique').on(t.fileId),
    check('load_report_photos_kind', sql`${t.kind} in ('NOTE', 'GOODS')`),
    check('load_report_photos_removed', sql`(${t.removedAt} is null) = (${t.removedByAccountId} is null) and (${t.removedAt} is null or not ${t.late})`),
  ],
);

/**
 * Antar sendiri (spec LT1 §15.2, LT3b; LOG-42, 43, 110, 117, 128): perjalanan karyawan cabang mengantar nota kasir "Diantar
 * kurir cabang". RUNNING (Foto 1 ambil barang) → DONE (Foto 3 kembali di cabang). Bukan trip truk: tanpa mobil, ritase, atau
 * upah. Tunai diserahkan ke laci cabang asal dan diterima karyawan cabang itu (bukan PJ). Tidak dihapus.
 */
export const selfTrips = logisticsSchema.table(
  'self_trips',
  {
    id: serial('id').primaryKey(),
    /** AS-YYMMDD-n, tanggal mulai (WIB). */
    number: text('number').notNull(),
    /** Cabang HRIS asal + cabang kasirnya. */
    branchId: integer('branch_id').notNull(),
    kasirBranchId: integer('kasir_branch_id').notNull(),
    /** PJ = yang memotret Foto 1 (LOG-43). */
    employeeId: integer('employee_id').notNull(),
    accountId: integer('account_id').notNull(),
    status: text('status').notNull().default('RUNNING'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    pickupPhotoFileId: uuid('pickup_photo_file_id').notNull(),
    startLatitude: doublePrecision('start_latitude'),
    startLongitude: doublePrecision('start_longitude'),
    startAccuracyM: integer('start_accuracy_m'),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    returnPhotoFileId: uuid('return_photo_file_id'),
    returnLatitude: doublePrecision('return_latitude'),
    returnLongitude: doublePrecision('return_longitude'),
    returnAccuracyM: integer('return_accuracy_m'),
    /** Selisih lama berangkat dan lama kembali ≥ batas (LOG-43): alasan baku + keterangan. */
    gapReason: text('gap_reason'),
    gapMinutes: integer('gap_minutes'),
    /** Tunai yang dibawa pulang (Lunas cash + Bayar sebagian), dihitung saat Foto 3. */
    cashAmount: integer('cash_amount').notNull().default(0),
    cashReceivedAt: timestamp('cash_received_at', { withTimezone: true }),
    cashReceivedByEmployeeId: integer('cash_received_by_employee_id'),
    cashReceivedByAccountId: integer('cash_received_by_account_id'),
    /** Ditutup kantor (LOG-110, spec LT1 §15.3): Kepala Toko / Kepala Gudang / Pemilik / GM, bukan PJ, alasan wajib. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedByEmployeeId: integer('closed_by_employee_id'),
    closedByAccountId: integer('closed_by_account_id'),
    closeReason: text('close_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('self_trips_number_unique').on(t.number),
    // Satu orang hanya satu perjalanan berjalan (LOG-43).
    uniqueIndex('self_trips_one_running').on(t.employeeId).where(sql`${t.status} = 'RUNNING'`),
    index('self_trips_branch_idx').on(t.branchId, t.startedAt),
    check('self_trips_status', sql`${t.status} in ('RUNNING', 'DONE', 'CLOSED')`),
    check('self_trips_done', sql`(${t.status} = 'DONE') = (${t.returnedAt} is not null and ${t.returnPhotoFileId} is not null)`),
    check('self_trips_closed', sql`(${t.status} = 'CLOSED') = (${t.closedAt} is not null and ${t.closedByAccountId} is not null and ${t.closeReason} is not null)`),
    check('self_trips_cash', sql`${t.cashAmount} >= 0 and (${t.cashAmount} = 0 or ${t.status} in ('DONE', 'CLOSED'))`),
    check('self_trips_cash_received', sql`(${t.cashReceivedAt} is null) = (${t.cashReceivedByAccountId} is null)
      and (${t.cashReceivedAt} is null or (${t.cashAmount} > 0 and ${t.cashReceivedByEmployeeId} is distinct from ${t.employeeId}))`),
    check('self_trips_gap', sql`(${t.gapReason} is null) or ${t.status} = 'DONE'`),
  ],
);

/**
 * Tujuan antar sendiri: satu per nota kasir. OPEN → DELIVERED (Terkirim) / TOMORROW (Kirim Besok, nota kembali ke daftar
 * tugas) / FAILED (Gagal, menunggu keputusan cabang asal). Satu nota hanya di satu tujuan yang masih berlaku.
 */
export const selfTripStops = logisticsSchema.table(
  'self_trip_stops',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => selfTrips.id),
    transactionId: integer('transaction_id').notNull(),
    trxNumber: text('trx_number').notNull(),
    /** Kosong = nota Umum (tanpa pelanggan). */
    customerId: integer('customer_id'),
    destinationName: text('destination_name').notNull(),
    /** Nominal kasir saat dibawa. */
    amountAtStart: integer('amount_at_start').notNull(),
    /** Pengantar di kasir bukan PJ ini / belum dipasangkan (LOG-108). */
    courierMismatch: boolean('courier_mismatch').notNull().default(false),
    status: text('status').notNull().default('OPEN'),
    reasonCode: text('reason_code'),
    reasonText: text('reason_text'),
    /** Foto 2 sampai di tujuan (LOG-43). */
    photoFileId: uuid('photo_file_id'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    doneByEmployeeId: integer('done_by_employee_id'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    accuracyM: integer('accuracy_m'),
    /** Jarak Terkirim dari titik toko Disetujui (meter), bila ada. */
    distanceM: integer('distance_m'),
    /** Tujuan tanpa hasil saat kantor menutup perjalanan → Kirim Besok tanpa Foto 2 (LOG-110). */
    officeClosed: boolean('office_closed').notNull().default(false),
    /** Keputusan Gagal oleh cabang asal (spec LT1 §15.3): RESEND = nota kembali ke daftar tugas, DROP = batal kirim. */
    decision: text('decision'),
    decisionReason: text('decision_reason'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedByAccountId: integer('decided_by_account_id'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('self_trip_stops_live').on(t.transactionId)
      .where(sql`${t.status} in ('OPEN', 'DELIVERED') or (${t.status} = 'FAILED' and ${t.decision} is distinct from 'RESEND')`),
    index('self_trip_stops_trip_idx').on(t.tripId),
    check('self_trip_stops_status', sql`${t.status} in ('OPEN', 'DELIVERED', 'TOMORROW', 'FAILED')`),
    check('self_trip_stops_done', sql`(${t.status} = 'OPEN') = (${t.doneAt} is null) and (${t.status} <> 'OPEN' or ${t.photoFileId} is null)
      and (${t.status} = 'OPEN' or ${t.photoFileId} is not null or ${t.officeClosed})`),
    check('self_trip_stops_office', sql`not ${t.officeClosed} or (${t.status} = 'TOMORROW' and ${t.photoFileId} is null)`),
    check('self_trip_stops_reason', sql`(${t.status} in ('TOMORROW', 'FAILED')) = (${t.reasonCode} is not null and ${t.reasonText} is not null)`),
    check('self_trip_stops_decision', sql`(${t.decision} is null or (${t.decision} in ('RESEND', 'DROP') and ${t.status} = 'FAILED'))
      and (${t.decision} is null) = (${t.decidedAt} is null) and (${t.decision} is null) = (${t.decidedByAccountId} is null)
      and (${t.decision} is distinct from 'DROP' or ${t.decisionReason} is not null)`),
  ],
);

/**
 * Riwayat tindakan kantor atas antar sendiri (spec LT1 §15.3): tutup perjalanan, alihkan PJ, keputusan Gagal. Tidak dihapus.
 */
export const selfTripEvents = logisticsSchema.table(
  'self_trip_events',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id').notNull().references(() => selfTrips.id),
    stopId: integer('stop_id').references(() => selfTripStops.id),
    kind: text('kind').notNull(),
    reason: text('reason'),
    fromEmployeeId: integer('from_employee_id'),
    toEmployeeId: integer('to_employee_id'),
    /**
     * Koreksi cara bayar (PAYMENT_CORRECTED, spec LT1 §15.4): tunai perjalanan sebelum / sesudah, dan tunai yang sudah
     * diterima laci saat dikoreksi (penerimaan itu dibuka lagi bila tunainya berubah).
     */
    cashBefore: integer('cash_before'),
    cashAfter: integer('cash_after'),
    cashReceivedBefore: integer('cash_received_before'),
    byEmployeeId: integer('by_employee_id').notNull(),
    byAccountId: integer('by_account_id').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('self_trip_events_trip_idx').on(t.tripId),
    check('self_trip_events_kind', sql`${t.kind} in ('CLOSED', 'HANDOVER', 'RESENT', 'DROPPED', 'PAYMENT_CORRECTED')`),
    check('self_trip_events_handover', sql`(${t.kind} = 'HANDOVER') = (${t.toEmployeeId} is not null and ${t.fromEmployeeId} is not null)`),
    check('self_trip_events_stop', sql`(${t.kind} in ('RESENT', 'DROPPED', 'PAYMENT_CORRECTED')) = (${t.stopId} is not null)`),
    check('self_trip_events_cash', sql`(${t.kind} = 'PAYMENT_CORRECTED') = (${t.cashBefore} is not null and ${t.cashAfter} is not null)`),
  ],
);

/**
 * Cara bayar saat Terkirim antar sendiri (spec LT1 §15.2; LOG-50, 117): aturan sama dengan `visit_payments`. Tagihan = sisa
 * piutang kasir nota itu; nota Umum / lunas = NONE. Tidak dihapus.
 */
export const selfTripPayments = logisticsSchema.table(
  'self_trip_payments',
  {
    id: serial('id').primaryKey(),
    stopId: integer('stop_id').notNull().references(() => selfTripStops.id),
    tripId: integer('trip_id').notNull().references(() => selfTrips.id),
    transactionId: integer('transaction_id').notNull(),
    customerId: integer('customer_id'),
    method: text('method').notNull(),
    billAmount: integer('bill_amount').notNull(),
    receivedAmount: integer('received_amount').notNull(),
    proofPhotoFileId: uuid('proof_photo_file_id'),
    promiseDate: date('promise_date', { mode: 'string' }),
    recordedByEmployeeId: integer('recorded_by_employee_id').notNull(),
    recordedByAccountId: integer('recorded_by_account_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    /** Koreksi salah tekan (spec LT1 §15.4): baris yang dikoreksi + alasan; baris lama ditandai Diganti. */
    correctionOfId: integer('correction_of_id'),
    correctionReason: text('correction_reason'),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('self_trip_payments_stop_current').on(t.stopId).where(sql`${t.replacedAt} is null`),
    index('self_trip_payments_trip_idx').on(t.tripId),
    check('self_trip_payments_method', sql`${t.method} in ('NONE', 'CASH', 'TRANSFER', 'PARTIAL', 'TEMPO')`),
    check('self_trip_payments_amounts', sql`${t.billAmount} >= 0 and ${t.receivedAmount} >= 0 and (
      (${t.method} = 'NONE' and ${t.billAmount} = 0 and ${t.receivedAmount} = 0)
      or (${t.method} in ('CASH', 'TRANSFER') and ${t.billAmount} > 0 and ${t.receivedAmount} = ${t.billAmount})
      or (${t.method} = 'PARTIAL' and ${t.receivedAmount} > 0 and ${t.receivedAmount} < ${t.billAmount})
      or (${t.method} = 'TEMPO' and ${t.billAmount} > 0 and ${t.receivedAmount} = 0))`),
    check('self_trip_payments_customer', sql`${t.method} = 'NONE' or ${t.customerId} is not null`),
    check('self_trip_payments_proof', sql`(${t.method} = 'TRANSFER') = (${t.proofPhotoFileId} is not null)`),
    check('self_trip_payments_promise', sql`(${t.promiseDate} is not null) = (${t.method} in ('PARTIAL', 'TEMPO'))`),
    check('self_trip_payments_correction', sql`(${t.correctionOfId} is null) = (${t.correctionReason} is null)`),
  ],
);

/**
 * Tagihan per nota saat Terkirim truk (spec LT1 §16.1 butir 2): sisa piutang kasir tiap nota kunjungan pada saat cara bayar
 * dicatat. Dasar pembagian uang per nota dan tanda pelunasan POS. Tetap walau cara bayar dikoreksi (tagihan tetap). Tidak dihapus.
 */
export const visitNoteBills = logisticsSchema.table(
  'visit_note_bills',
  {
    id: serial('id').primaryKey(),
    visitId: integer('visit_id').notNull().references(() => tripVisits.id),
    noteId: integer('note_id').notNull().references(() => deliveryNotes.id),
    /** Nota kasir (`delivery_notes.doc_id`, jenis SALE). */
    transactionId: integer('transaction_id').notNull(),
    billAmount: integer('bill_amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('visit_note_bills_unique').on(t.visitId, t.noteId),
    check('visit_note_bills_amount', sql`${t.billAmount} >= 0`),
  ],
);

/**
 * Pemeriksaan uang per nota (spec LT1 §16.1, LT4a): Finance mencocokkan uang yang dibawa / ditransfer dengan laporan cara bayar.
 * Satu baris berlaku per nota per cara bayar (truk: `visit_payment_id` + nota; antar sendiri: `self_payment_id`). Kurang serah tunai
 * atas nama pembawa (`responsible_employee_id`); transfer kurang tetap piutang toko. `pos_expected_amount` = yang harus dilunasi di
 * POS. Batal = tanda + alasan, tidak dihapus.
 */
export const moneyChecks = logisticsSchema.table(
  'money_checks',
  {
    id: serial('id').primaryKey(),
    /** TRUCK / SELF. */
    source: text('source').notNull(),
    visitPaymentId: integer('visit_payment_id').references(() => visitPayments.id),
    selfPaymentId: integer('self_payment_id').references(() => selfTripPayments.id),
    tripId: integer('trip_id').references(() => trips.id),
    selfTripId: integer('self_trip_id').references(() => selfTrips.id),
    transactionId: integer('transaction_id').notNull(),
    noteNumber: text('note_number').notNull(),
    /** CASH (Lunas cash / Bayar sebagian) atau TRANSFER. */
    kind: text('kind').notNull(),
    reportedAmount: integer('reported_amount').notNull(),
    actualAmount: integer('actual_amount').notNull(),
    posExpectedAmount: integer('pos_expected_amount').notNull(),
    /** Tagihan nota saat Terkirim (null = tidak diketahui, kunjungan sebelum LT4a). */
    billAmount: integer('bill_amount'),
    responsibleEmployeeId: integer('responsible_employee_id'),
    note: text('note'),
    checkedByAccountId: integer('checked_by_account_id').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByAccountId: integer('voided_by_account_id'),
    voidReason: text('void_reason'),
  },
  (t) => [
    uniqueIndex('money_checks_truck_current').on(t.visitPaymentId, t.transactionId).where(sql`${t.voidedAt} is null and ${t.visitPaymentId} is not null`),
    uniqueIndex('money_checks_self_current').on(t.selfPaymentId).where(sql`${t.voidedAt} is null and ${t.selfPaymentId} is not null`),
    index('money_checks_transaction_idx').on(t.transactionId),
    check('money_checks_source', sql`(${t.source} = 'TRUCK' and ${t.visitPaymentId} is not null and ${t.tripId} is not null and ${t.selfPaymentId} is null and ${t.selfTripId} is null)
      or (${t.source} = 'SELF' and ${t.selfPaymentId} is not null and ${t.selfTripId} is not null and ${t.visitPaymentId} is null and ${t.tripId} is null)`),
    check('money_checks_kind', sql`${t.kind} in ('CASH', 'TRANSFER')`),
    check('money_checks_amounts', sql`${t.reportedAmount} >= 0 and ${t.actualAmount} >= 0 and ${t.posExpectedAmount} >= 0
      and (${t.billAmount} is null or ${t.billAmount} >= 0)`),
    check('money_checks_note', sql`${t.reportedAmount} = ${t.actualAmount} or ${t.note} is not null`),
    check('money_checks_responsible', sql`${t.responsibleEmployeeId} is null or (${t.kind} = 'CASH' and ${t.actualAmount} < ${t.reportedAmount})`),
    check('money_checks_voided', sql`(${t.voidedAt} is null) = (${t.voidedByAccountId} is null) and (${t.voidedAt} is null) = (${t.voidReason} is null)`),
  ],
);

/**
 * Pengisian bensin (spec LT1 §17.1 butir 1–5): sumber uang keluar bensin yang nanti dibaca modul Keuangan lewat view
 * `logistics.fuel_expenses`. Diisi Finance dari permintaan driver (`request_id`) atau tanpa permintaan (alasan wajib).
 * Ubah = baris baru menunjuk `correction_of_id`, baris lama `replaced_at`; Batal = `voided_at`. Tidak dihapus.
 */
export const fuelFills = logisticsSchema.table(
  'fuel_fills',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id').references(() => tripEndReports.id),
    vehicleId: integer('vehicle_id').notNull().references(() => vehicles.id),
    driverEmployeeId: integer('driver_employee_id').notNull(),
    filledOn: date('filled_on', { mode: 'string' }).notNull(),
    amount: integer('amount').notNull(),
    receiptFileId: uuid('receipt_file_id').notNull(),
    /** Alasan tanpa permintaan (mis. "Driver lupa minta"); wajib bila request_id kosong. */
    noRequestReason: text('no_request_reason'),
    /** Cabang HRIS yang dibebani (cabang garasi Logistik saat dicatat). */
    chargeBranchId: integer('charge_branch_id'),
    correctionOfId: integer('correction_of_id'),
    correctionReason: text('correction_reason'),
    recordedByAccountId: integer('recorded_by_account_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByAccountId: integer('voided_by_account_id'),
    voidReason: text('void_reason'),
  },
  (t) => [
    uniqueIndex('fuel_fills_request_current').on(t.requestId).where(sql`${t.requestId} is not null and ${t.replacedAt} is null and ${t.voidedAt} is null`),
    index('fuel_fills_filled_on_idx').on(t.filledOn),
    index('fuel_fills_vehicle_idx').on(t.vehicleId),
    check('fuel_fills_amount', sql`${t.amount} > 0`),
    check('fuel_fills_request', sql`(${t.requestId} is null) = (${t.noRequestReason} is not null)`),
    check('fuel_fills_correction', sql`(${t.correctionOfId} is null) = (${t.correctionReason} is null)`),
    check('fuel_fills_voided', sql`(${t.voidedAt} is null) = (${t.voidedByAccountId} is null) and (${t.voidedAt} is null) = (${t.voidReason} is null)
      and (${t.voidedAt} is null or ${t.replacedAt} is null)`),
  ],
);

/**
 * Tinjau kiriman di luar titik toko (spec LT1 §17.1 butir 9; LOG-142): satu per kunjungan truk Terkirim atau tujuan antar
 * sendiri Terkirim. OK = Wajar, NOT_OK = Tidak wajar (alasan wajib). Tidak dihapus.
 */
export const outsidePointReviews = logisticsSchema.table(
  'outside_point_reviews',
  {
    id: serial('id').primaryKey(),
    visitId: integer('visit_id').references(() => tripVisits.id),
    selfStopId: integer('self_stop_id').references(() => selfTripStops.id),
    verdict: text('verdict').notNull(),
    reason: text('reason'),
    reviewedByAccountId: integer('reviewed_by_account_id').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('outside_point_reviews_visit').on(t.visitId).where(sql`${t.visitId} is not null`),
    uniqueIndex('outside_point_reviews_self_stop').on(t.selfStopId).where(sql`${t.selfStopId} is not null`),
    check('outside_point_reviews_target', sql`(${t.visitId} is null) <> (${t.selfStopId} is null)`),
    check('outside_point_reviews_verdict', sql`${t.verdict} in ('OK', 'NOT_OK') and (${t.verdict} = 'OK' or ${t.reason} is not null)`),
  ],
);
