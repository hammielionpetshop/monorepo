import { sql } from 'drizzle-orm';
import { boolean, check, date, doublePrecision, index, integer, primaryKey, serial, smallint, text, time, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { branches } from './access';
import { employees } from './employees';
import { files } from './files';
import { hrisSchema } from './shared';

// L3a Jam Kerja & Jadwal (spec 2026-11-01-hris-l3a-schedule-design). Tidak ada baris yang dihapus (PRI-02).

export const shiftAssignmentOrigin = hrisSchema.enum('shift_assignment_origin', ['MACHINE', 'INITIAL', 'MANUAL']);

// Identitas shift milik cabang (KEH-01); jamnya ada di versi bertanggal.
export const workShifts = hrisSchema.table(
  'work_shifts',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    name: text('name').notNull(),
    position: smallint('position').notNull(),
    active: boolean('active').notNull().default(true),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('work_shifts_branch_name_unique').on(t.branchId, sql`lower(${t.name})`),
    check('work_shifts_name_not_blank', sql`btrim(${t.name}) <> ''`),
  ],
);

// Jam kerja bertanggal berlaku (KEH-02) + istirahat per shift (KEH-82).
export const workShiftVersions = hrisSchema.table(
  'work_shift_versions',
  {
    id: serial('id').primaryKey(),
    shiftId: integer('shift_id').notNull().references(() => workShifts.id),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    breakMinutes: smallint('break_minutes'),
    breakStartFrom: time('break_start_from'),
    breakStartUntil: time('break_start_until'),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    effectiveUntil: date('effective_until', { mode: 'string' }),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('work_shift_versions_one_per_day').on(t.shiftId, t.effectiveFrom).where(sql`${t.cancelledAt} is null`),
    check('work_shift_versions_hours_differ', sql`${t.startTime} <> ${t.endTime}`),
    check('work_shift_versions_break_complete', sql`(${t.breakMinutes} is null) = (${t.breakStartFrom} is null)
      and (${t.breakMinutes} is null) = (${t.breakStartUntil} is null)`),
    check('work_shift_versions_range', sql`${t.effectiveUntil} is null or ${t.effectiveUntil} >= ${t.effectiveFrom}`),
    check('work_shift_versions_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
  ],
);

// Dua kelompok giliran per cabang; minggu acuan = Senin saat giliran awal diisi (KEH-06, KEH-102).
export const shiftGroups = hrisSchema.table(
  'shift_groups',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
    anchorWeek: date('anchor_week', { mode: 'string' }).notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shift_groups_branch_position_unique').on(t.branchId, t.position),
    check('shift_groups_two_per_branch', sql`${t.position} in (0, 1)`),
  ],
);

export const shiftGroupMembers = hrisSchema.table(
  'shift_group_members',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id').notNull().references(() => shiftGroups.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    effectiveUntil: date('effective_until', { mode: 'string' }),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shift_group_members_one_open').on(t.employeeId).where(sql`${t.effectiveUntil} is null`),
    index('shift_group_members_group_idx').on(t.groupId),
  ],
);

// Shift seseorang untuk satu minggu Senin-Minggu (KEH-05). Kunci unik membuat mesin aman diulang.
export const shiftAssignments = hrisSchema.table(
  'shift_assignments',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    shiftId: integer('shift_id').notNull().references(() => workShifts.id),
    origin: shiftAssignmentOrigin('origin').notNull(),
    createdByAccountId: integer('created_by_account_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shift_assignments_person_week_unique').on(t.employeeId, t.branchId, t.weekStart),
    index('shift_assignments_branch_week_idx').on(t.branchId, t.weekStart),
    check('shift_assignments_monday', sql`extract(isodow from ${t.weekStart}) = 1`),
  ],
);

// Ubah shift mendadak per hari (KEH-45, keputusan owner spec L3a §9 butir 1). Baris terbaru yang berlaku.
export const shiftDayChanges = hrisSchema.table(
  'shift_day_changes',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    shiftId: integer('shift_id').notNull().references(() => workShifts.id),
    previousShiftId: integer('previous_shift_id').references(() => workShifts.id),
    /** Tukar shift dengan teman (KEH-43, spec L3e): dua baris, satu per orang, ajakan yang sama. */
    swapInvitationId: integer('swap_invitation_id'),
    reason: text('reason').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shift_day_changes_person_date_idx').on(t.employeeId, t.workDate),
    check('shift_day_changes_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
  ],
);

// Satu QR aktif per cabang (KEH-11). Buat ulang mengisi dead_at pada QR lama.
export const branchQrCodes = hrisSchema.table(
  'branch_qr_codes',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    code: text('code').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deadAt: timestamp('dead_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('branch_qr_codes_code_unique').on(t.code),
    uniqueIndex('branch_qr_codes_one_alive').on(t.branchId).where(sql`${t.deadAt} is null`),
  ],
);

// Hari tutup (KEH-79, KEH-105). Cabang kosong = semua cabang.
export const branchClosures = hrisSchema.table(
  'branch_closures',
  {
    id: serial('id').primaryKey(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    branchId: integer('branch_id').references(() => branches.id),
    reason: text('reason').notNull(),
    backdated: boolean('backdated').notNull(),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    index('branch_closures_dates_idx').on(t.startDate, t.endDate),
    check('branch_closures_range', sql`${t.endDate} >= ${t.startDate}`),
    check('branch_closures_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
    check('branch_closures_cancel_complete', sql`(${t.cancelledAt} is null) = (${t.cancelReason} is null)`),
  ],
);

// Peringatan pemeriksa giliran paling banyak sekali per cabang per minggu (spec L3a §6).
export const shiftCheckNotices = hrisSchema.table(
  'shift_check_notices',
  {
    branchId: integer('branch_id').notNull().references(() => branches.id),
    weekStart: date('week_start', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.branchId, t.weekStart] })],
);

// L3b Absen dan Istirahat (spec 2026-11-01-hris-l3b-attendance-design).

export const attendanceKind = hrisSchema.enum('attendance_kind', ['IN', 'BREAK', 'RETURN', 'OUT']);
export const attendanceAttemptResult = hrisSchema.enum('attendance_attempt_result', [
  'OK', 'OUTSIDE', 'NO_LOCATION', 'BAD_QR', 'WRONG_BRANCH', 'TOO_EARLY', 'CLOSED', 'TOO_SOON',
]);
export const branchAssistAnswer = hrisSchema.enum('branch_assist_answer', ['ASSIST', 'WRONG_SCAN']);

// Semua percobaan tercatat, apa pun hasilnya (KEH-12). Hanya tambah.
export const attendanceAttempts = hrisSchema.table(
  'attendance_attempts',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    kind: attendanceKind('kind').notNull(),
    qrCodeId: integer('qr_code_id').references(() => branchQrCodes.id),
    branchId: integer('branch_id').references(() => branches.id),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    accuracyM: integer('accuracy_m'),
    distanceM: integer('distance_m'),
    result: attendanceAttemptResult('result').notNull(),
    // Jawaban perbantuan dibawa dari langkah lokasi ke Kirim.
    isAssist: boolean('is_assist').notNull().default(false),
    chosenShiftId: integer('chosen_shift_id').references(() => workShifts.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('attendance_attempts_person_time_idx').on(t.employeeId, t.createdAt)],
);

// Satu hari kerja satu orang. Angka hitungan diisi server sekali (KEH-21, 86); pagarnya di trigger migrasi.
export const attendanceDays = hrisSchema.table(
  'attendance_days',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    positionId: integer('position_id').notNull(),
    shiftId: integer('shift_id').references(() => workShifts.id),
    shiftVersionId: integer('shift_version_id').references(() => workShiftVersions.id),
    shiftSource: text('shift_source').notNull(),
    lateMinutes: integer('late_minutes'),
    earlyLeaveMinutes: integer('early_leave_minutes'),
    breakOverMinutes: integer('break_over_minutes'),
    aloneNoBreak: boolean('alone_no_break').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('attendance_days_person_date_unique').on(t.employeeId, t.workDate),
    index('attendance_days_branch_date_idx').on(t.branchId, t.workDate),
  ],
);

// Catatan absen. Tidak bisa diubah atau dihapus (KEH-16); wajib GPS dan foto selain Istirahat (syarat owner, KEH-83).
export const attendanceRecords = hrisSchema.table(
  'attendance_records',
  {
    id: serial('id').primaryKey(),
    dayId: integer('day_id').notNull().references(() => attendanceDays.id),
    kind: attendanceKind('kind').notNull(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    accuracyM: integer('accuracy_m'),
    distanceM: integer('distance_m'),
    needsReview: boolean('needs_review').notNull().default(false),
    photoFileId: uuid('photo_file_id').references(() => files.id),
    attemptId: integer('attempt_id').references(() => attendanceAttempts.id),
  },
  (t) => [
    uniqueIndex('attendance_records_day_kind_unique').on(t.dayId, t.kind),
    index('attendance_records_time_idx').on(t.recordedAt),
    check('attendance_records_proof', sql`${t.kind} = 'BREAK' or (${t.latitude} is not null and ${t.longitude} is not null and ${t.distanceM} is not null and ${t.photoFileId} is not null and ${t.attemptId} is not null)`),
  ],
);

// Jawaban saat memindai QR cabang lain (KEH-26, 109). Salah scan boleh berkali-kali, perbantuan satu per hari.
export const branchAssists = hrisSchema.table(
  'branch_assists',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    homeBranchId: integer('home_branch_id').notNull().references(() => branches.id),
    targetBranchId: integer('target_branch_id').notNull().references(() => branches.id),
    answer: branchAssistAnswer('answer').notNull(),
    shiftId: integer('shift_id').references(() => workShifts.id),
    shiftChosen: boolean('shift_chosen').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('branch_assists_one_per_day').on(t.employeeId, t.workDate).where(sql`${t.answer} = 'ASSIST'`),
    index('branch_assists_target_date_idx').on(t.targetBranchId, t.workDate),
  ],
);

// Setiap pembukaan foto dicatat (KEH-119).
export const attendancePhotoViews = hrisSchema.table(
  'attendance_photo_views',
  {
    id: serial('id').primaryKey(),
    recordId: integer('record_id').notNull().references(() => attendanceRecords.id),
    viewedByAccountId: integer('viewed_by_account_id').notNull(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('attendance_photo_views_record_idx').on(t.recordId)],
);

// Isi foto dibuang lewat masa simpan (KEH-15). `files` hanya tambah, jadi penandanya tabel sendiri.
export const attendancePhotoPurges = hrisSchema.table('attendance_photo_purges', {
  fileId: uuid('file_id').primaryKey().references(() => files.id),
  purgedAt: timestamp('purged_at', { withTimezone: true }).notNull().defaultNow(),
});

// L3c Tinjau, Koreksi, dan Rekap (spec 2026-11-02-hris-l3c-review-design). Semua tabel hanya tambah.

export const attendanceReviewOutcome = hrisSchema.enum('attendance_review_outcome', ['FINE', 'NEEDS_CORRECTION']);
export const attendanceCorrectionReason = hrisSchema.enum('attendance_correction_reason', ['DEVICE', 'MOVED', 'WRONG_RECORD', 'OTHER']);
export const attendancePatternKind = hrisSchema.enum('attendance_pattern_kind', ['REPEAT_OUTSIDE', 'SHARED_POINT']);

// Putusan atas absen luar titik (KEH-114). Putusan yang berlaku = baris terbaru per catatan absen.
export const attendanceReviews = hrisSchema.table(
  'attendance_reviews',
  {
    id: serial('id').primaryKey(),
    recordId: integer('record_id').notNull().references(() => attendanceRecords.id),
    outcome: attendanceReviewOutcome('outcome').notNull(),
    reason: text('reason').notNull(),
    decidedByAccountId: integer('decided_by_account_id').notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('attendance_reviews_record_idx').on(t.recordId, t.id),
    check('attendance_reviews_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
  ],
);

// Koreksi menyimpan keadaan hari utuh, lama dan baru (KEH-28, 116). Keadaan berlaku = koreksi terbaru per orang + tanggal.
// Keadaan tanpa jam masuk = hari tanpa absen (hasil membalik Tambah absen).
export const attendanceCorrections = hrisSchema.table(
  'attendance_corrections',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    branchId: integer('branch_id').references(() => branches.id),
    shiftId: integer('shift_id').references(() => workShifts.id),
    shiftVersionId: integer('shift_version_id').references(() => workShiftVersions.id),
    inAt: timestamp('in_at', { withTimezone: true }),
    outAt: timestamp('out_at', { withTimezone: true }),
    prevBranchId: integer('prev_branch_id').references(() => branches.id),
    prevShiftId: integer('prev_shift_id').references(() => workShifts.id),
    prevShiftVersionId: integer('prev_shift_version_id').references(() => workShiftVersions.id),
    prevInAt: timestamp('prev_in_at', { withTimezone: true }),
    prevOutAt: timestamp('prev_out_at', { withTimezone: true }),
    lateMinutes: integer('late_minutes'),
    earlyLeaveMinutes: integer('early_leave_minutes'),
    reasonCode: attendanceCorrectionReason('reason_code').notNull(),
    note: text('note').notNull(),
    batchId: uuid('batch_id'),
    reversesId: integer('reverses_id'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('attendance_corrections_person_date_idx').on(t.employeeId, t.workDate, t.id),
    index('attendance_corrections_date_idx').on(t.workDate),
    check('attendance_corrections_state', sql`(${t.inAt} is null) = (${t.branchId} is null) and (${t.outAt} is null or ${t.inAt} is not null)`),
    check('attendance_corrections_order', sql`${t.outAt} is null or ${t.outAt} > ${t.inAt}`),
    check('attendance_corrections_note_not_blank', sql`btrim(${t.note}) <> ''`),
  ],
);

// Tanda pola lokasi mencurigakan (KEH-115), ditulis mesin sekali per kejadian.
export const attendancePatternFlags = hrisSchema.table(
  'attendance_pattern_flags',
  {
    id: serial('id').primaryKey(),
    kind: attendancePatternKind('kind').notNull(),
    detectedOn: date('detected_on', { mode: 'string' }).notNull(),
    fingerprint: text('fingerprint').notNull(),
    employeeIds: integer('employee_ids').array().notNull(),
    recordIds: integer('record_ids').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('attendance_pattern_flags_fingerprint_unique').on(t.fingerprint),
    index('attendance_pattern_flags_detected_idx').on(t.detectedOn),
  ],
);

export const attendancePatternSeen = hrisSchema.table(
  'attendance_pattern_seen',
  {
    id: serial('id').primaryKey(),
    flagId: integer('flag_id').notNull().references(() => attendancePatternFlags.id),
    seenByAccountId: integer('seen_by_account_id').notNull(),
    note: text('note').notNull(),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('attendance_pattern_seen_flag_idx').on(t.flagId)],
);

// L3d Laporan Pulang, Serah Terima, Lapor Masalah, Sudah Pindah Cabang (spec 2026-11-02-hris-l3d-end-of-day-design).
// Semua tabel hanya tambah (KEH-95, PRI-02); isi terkirim tidak bisa diubah, hanya Tambah keterangan.

export const handoverRecipientMode = hrisSchema.enum('handover_recipient_mode', ['TEAM', 'PEOPLE']);
export const problemReportOrigin = hrisSchema.enum('problem_report_origin', ['END_OF_DAY', 'MENU']);
export const problemReportStatus = hrisSchema.enum('problem_report_status', ['RECEIVED', 'IN_PROGRESS', 'DONE']);
export const reportNoteKind = hrisSchema.enum('report_note_kind', ['HANDOVER', 'PROBLEM']);
export const relocationAnswer = hrisSchema.enum('relocation_answer', ['YES', 'NOT_YET']);

// Laporan Pulang satu hari kerja (KEH-89, 125). Hari baru dihitung pulang bila laporan ini ada.
export const endOfDayReports = hrisSchema.table(
  'end_of_day_reports',
  {
    id: serial('id').primaryKey(),
    dayId: integer('day_id').notNull().references(() => attendanceDays.id),
    outRecordId: integer('out_record_id').notNull().references(() => attendanceRecords.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    handover: text('handover').notNull(),
    recipientMode: handoverRecipientMode('recipient_mode').notNull(),
    photoFileId: uuid('photo_file_id').references(() => files.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('end_of_day_reports_day_unique').on(t.dayId),
    index('end_of_day_reports_branch_time_idx').on(t.branchId, t.submittedAt),
    index('end_of_day_reports_person_idx').on(t.employeeId, t.submittedAt),
    check('end_of_day_reports_handover_not_blank', sql`btrim(${t.handover}) <> ''`),
  ],
);

// Penerima dibekukan saat terkirim (KEH-90). Kosong = Tidak ada penerima (KEH-127).
export const handoverRecipients = hrisSchema.table(
  'handover_recipients',
  {
    reportId: integer('report_id').notNull().references(() => endOfDayReports.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.employeeId] }), index('handover_recipients_person_idx').on(t.employeeId)],
);

export const handoverReads = hrisSchema.table(
  'handover_reads',
  {
    reportId: integer('report_id').notNull().references(() => endOfDayReports.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.employeeId] })],
);

// Laporan masalah rahasia (KEH-93, 128): hanya Pemilik dan GM; yang menyangkut GM hanya Pemilik.
export const problemReports = hrisSchema.table(
  'problem_reports',
  {
    id: serial('id').primaryKey(),
    reporterEmployeeId: integer('reporter_employee_id').notNull().references(() => employees.id),
    body: text('body').notNull(),
    photoFileId: uuid('photo_file_id').references(() => files.id),
    concernsGm: boolean('concerns_gm').notNull().default(false),
    origin: problemReportOrigin('origin').notNull(),
    endOfDayReportId: integer('end_of_day_report_id').references(() => endOfDayReports.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('problem_reports_time_idx').on(t.submittedAt),
    index('problem_reports_reporter_idx').on(t.reporterEmployeeId),
    uniqueIndex('problem_reports_one_per_end_of_day').on(t.endOfDayReportId).where(sql`${t.endOfDayReportId} is not null`),
    check('problem_reports_body_not_blank', sql`btrim(${t.body}) <> ''`),
    check('problem_reports_origin_link', sql`(${t.origin} = 'END_OF_DAY') = (${t.endOfDayReportId} is not null)`),
  ],
);

// Status berlaku = baris terbaru; tanggapan satu kalimat tampil ke pelapor (KEH-129).
export const problemReportEvents = hrisSchema.table(
  'problem_report_events',
  {
    id: serial('id').primaryKey(),
    reportId: integer('report_id').notNull().references(() => problemReports.id),
    status: problemReportStatus('status').notNull(),
    response: text('response'),
    byAccountId: integer('by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('problem_report_events_report_idx').on(t.reportId, t.id)],
);

// Tambah keterangan oleh pengirimnya sendiri (KEH-95).
export const reportNotes = hrisSchema.table(
  'report_notes',
  {
    id: serial('id').primaryKey(),
    kind: reportNoteKind('kind').notNull(),
    reportId: integer('report_id').notNull(),
    body: text('body').notNull(),
    byEmployeeId: integer('by_employee_id').notNull().references(() => employees.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('report_notes_report_idx').on(t.kind, t.reportId),
    check('report_notes_body_not_blank', sql`btrim(${t.body}) <> ''`),
  ],
);

// Jawaban "Sudah pindah cabang?" (KEH-27, KEH-L10). Ya = pengajuan "Usulan pindah cabang" (request_id).
export const relocationPrompts = hrisSchema.table(
  'relocation_prompts',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    fromBranchId: integer('from_branch_id').notNull().references(() => branches.id),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    answer: relocationAnswer('answer').notNull(),
    requestId: integer('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('relocation_prompts_person_date_unique').on(t.employeeId, t.workDate),
    uniqueIndex('relocation_prompts_request_unique').on(t.requestId).where(sql`${t.requestId} is not null`),
    check('relocation_prompts_request_when_yes', sql`(${t.answer} = 'YES') = (${t.requestId} is not null)`),
  ],
);

// L3e Libur dan Tukar (spec 2026-11-02-hris-l3e-days-off-design). Tidak ada yang dihapus (PRI-02):
// libur yang dilepas, digeser, atau dicabut berganti status; status hanya berubah dari keadaan awalnya.

export const dayOffOrigin = hrisSchema.enum('day_off_origin', ['PICK', 'LATE', 'SWAP', 'DIRECT', 'REPLACEMENT']);
export const dayOffStatus = hrisSchema.enum('day_off_status', ['ACTIVE', 'REPLACED', 'REVOKED']);
export const swapKind = hrisSchema.enum('swap_kind', ['DAY_OFF', 'SHIFT']);
export const swapStatus = hrisSchema.enum('swap_status', ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED']);
export const workRequestStatus = hrisSchema.enum('work_request_status', ['REQUESTED', 'READY', 'CANCELLED']);
export const replacementStatus = hrisSchema.enum('replacement_status', ['WAITING', 'CHOSEN', 'EXPIRED']);

// Satu tanggal libur seseorang (KEH-31, 131). Libur pengganti (REPLACEMENT) tidak dihitung dalam jatah (KEH-138).
export const dayOffPicks = hrisSchema.table(
  'day_off_picks',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    offDate: date('off_date', { mode: 'string' }).notNull(),
    origin: dayOffOrigin('origin').notNull(),
    status: dayOffStatus('status').notNull().default('ACTIVE'),
    createdByAccountId: integer('created_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    swapInvitationId: integer('swap_invitation_id'),
    replacementId: integer('replacement_id'),
    note: text('note'),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endedByAccountId: integer('ended_by_account_id'),
    endReason: text('end_reason'),
    replacedById: integer('replaced_by_id'),
  },
  (t) => [
    uniqueIndex('day_off_picks_one_active_per_date').on(t.employeeId, t.offDate).where(sql`${t.status} = 'ACTIVE'`),
    index('day_off_picks_person_period_idx').on(t.employeeId, t.periodStart),
    index('day_off_picks_date_idx').on(t.offDate),
    check('day_off_picks_period_day', sql`extract(day from ${t.periodStart}) = 26`),
    check('day_off_picks_ended', sql`(${t.status} = 'ACTIVE') = (${t.endedAt} is null)`),
  ],
);

// Satu tanda tidak memilih libur per orang per periode (KEH-135); Gaji membacanya sebagai denda (GAJ-16).
export const dayOffMissingMarks = hrisSchema.table(
  'day_off_missing_marks',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    quota: smallint('quota').notNull(),
    pickedCount: smallint('picked_count').notNull(),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('day_off_missing_marks_person_period_unique').on(t.employeeId, t.periodStart)],
);

// Ajakan tukar libur atau shift dengan teman satu cabang (KEH-43, 44, 136). Dijawab teman, bukan atasan.
export const swapInvitations = hrisSchema.table(
  'swap_invitations',
  {
    id: serial('id').primaryKey(),
    kind: swapKind('kind').notNull(),
    branchId: integer('branch_id').notNull().references(() => branches.id),
    fromEmployeeId: integer('from_employee_id').notNull().references(() => employees.id),
    toEmployeeId: integer('to_employee_id').notNull().references(() => employees.id),
    fromDate: date('from_date', { mode: 'string' }).notNull(),
    toDate: date('to_date', { mode: 'string' }).notNull(),
    fromPickId: integer('from_pick_id').references(() => dayOffPicks.id),
    toPickId: integer('to_pick_id').references(() => dayOffPicks.id),
    fromShiftId: integer('from_shift_id').references(() => workShifts.id),
    toShiftId: integer('to_shift_id').references(() => workShifts.id),
    answerBy: date('answer_by', { mode: 'string' }).notNull(),
    status: swapStatus('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('swap_invitations_one_pending').on(t.fromEmployeeId, t.fromDate).where(sql`${t.status} = 'PENDING'`),
    index('swap_invitations_to_idx').on(t.toEmployeeId, t.status),
    index('swap_invitations_branch_idx').on(t.branchId, t.createdAt),
    check('swap_invitations_two_people', sql`${t.fromEmployeeId} <> ${t.toEmployeeId}`),
    check('swap_invitations_shape', sql`(${t.kind} = 'DAY_OFF' and ${t.fromPickId} is not null and ${t.toPickId} is not null)
      or (${t.kind} = 'SHIFT' and ${t.fromDate} = ${t.toDate} and ${t.fromShiftId} is not null and ${t.toShiftId} is not null)`),
    check('swap_invitations_answered', sql`(${t.status} = 'PENDING') = (${t.answeredAt} is null)`),
  ],
);

// Diminta masuk di hari libur (KEH-46, 137). Tidak ada Tolak: peminta membatalkan.
export const dayOffWorkRequests = hrisSchema.table(
  'day_off_work_requests',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    pickId: integer('pick_id').notNull().references(() => dayOffPicks.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    requestedByAccountId: integer('requested_by_account_id').notNull(),
    requestedByEmployeeId: integer('requested_by_employee_id').notNull().references(() => employees.id),
    reason: text('reason').notNull(),
    status: workRequestStatus('status').notNull().default('REQUESTED'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByAccountId: integer('cancelled_by_account_id'),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    uniqueIndex('day_off_work_requests_one_live').on(t.employeeId, t.workDate).where(sql`${t.status} <> 'CANCELLED'`),
    index('day_off_work_requests_date_idx').on(t.workDate),
    check('day_off_work_requests_not_self', sql`${t.employeeId} <> ${t.requestedByEmployeeId}`),
    check('day_off_work_requests_reason_not_blank', sql`btrim(${t.reason}) <> ''`),
  ],
);

// Libur pengganti; lahir hanya saat absen Masuk tercatat di tanggal yang diminta (KEH-138).
export const replacementDaysOff = hrisSchema.table(
  'replacement_days_off',
  {
    id: serial('id').primaryKey(),
    workRequestId: integer('work_request_id').notNull().references(() => dayOffWorkRequests.id),
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    chooseBy: date('choose_by', { mode: 'string' }).notNull(),
    pickId: integer('pick_id').references(() => dayOffPicks.id),
    status: replacementStatus('status').notNull().default('WAITING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('replacement_days_off_request_unique').on(t.workRequestId),
    index('replacement_days_off_person_idx').on(t.employeeId, t.status),
    check('replacement_days_off_chosen', sql`(${t.status} = 'CHOSEN') = (${t.pickId} is not null)`),
  ],
);

// Pengingat sekali per tanda (spec L3e §9 butir 8). Kunci = orang + rujukan, aman diulang.
export const dayOffNotices = hrisSchema.table(
  'day_off_notices',
  {
    employeeId: integer('employee_id').notNull().references(() => employees.id),
    ref: text('ref').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.ref] })],
);
