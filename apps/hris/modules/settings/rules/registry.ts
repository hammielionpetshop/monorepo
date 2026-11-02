import type { ActionName } from '@/modules/access';

/**
 * Daftar pengaturan HRIS (spec L2e §3.1). Daftar di kode, bukan tabel, seperti daftar tindakan (KAR-71):
 * pengaturan yang dipakai kode tetapi tidak terdaftar = tes mesin pengaman gagal (H18).
 * Isi awal tiap kunci ditanam migrasi modul pemiliknya (sasaran ALL, 2026-01-01).
 */

export type TargetKind = 'ALL' | 'POSITION' | 'BRANCH';

export type ValueType =
  | { kind: 'integer'; min: number; max: number }
  | { kind: 'choice'; options: readonly { value: string; label: string }[] }
  /** Id jabatan sebagai teks; pilihannya dibaca dari data jabatan aktif. */
  | { kind: 'position' };

export type SettingDefinition = {
  label: string;
  module: string;
  /** Satu kalimat tentang apa yang dipengaruhi (BER-L41 langkah 1). */
  explain: string;
  type: ValueType;
  unit?: string;
  targets: readonly TargetKind[];
  /** Menyangkut uang atau hitungan: berlaku paling cepat besok, tombol ditahan (WAJ-07). */
  affectsMoney: boolean;
  /** Hanya boleh berlaku mulai tanggal ini tiap bulan (mis. 26 untuk angka gaji, PRI-44 butir 1). */
  startDay?: number;
  /** Disimpan untuk Papan Perubahan Aturan (menyusul). */
  mustAnnounce: boolean;
  /** Disimpan untuk Daftar Pengecualian (L3). */
  exemptible: boolean;
  viewAction: ActionName;
  editAction: ActionName;
  /** OWNER_DIRECT: Pemilik/GM langsung berlaku. PROPOSE_APPROVE: usulan HR disetujui Pemilik/GM (L2f). */
  review: 'OWNER_DIRECT' | 'PROPOSE_APPROVE';
};

export const MODULE_LABELS: Record<string, string> = {
  shared: 'Bersama',
  employees: 'Karyawan',
  position: 'Pengaturan Jabatan',
  requests: 'Pengajuan',
  accounts: 'Akun',
  attendance: 'Kehadiran',
};

export const ROLE_SUGGESTIONS = [
  { value: 'NONE', label: 'Tanpa saran' },
  { value: 'KASIR', label: 'Kasir' },
  { value: 'GUDANG', label: 'Gudang' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'FINANCE', label: 'Finance' },
] as const;

export const FIELD_DUTIES = [
  { value: 'NONE', label: 'Tidak' },
  { value: 'DRIVE', label: 'Menyetir' },
  { value: 'ASSIST', label: 'Kenek' },
  { value: 'BOTH', label: 'Menyetir dan kenek' },
] as const;

export const YES_NO = [
  { value: 'YES', label: 'Ya' },
  { value: 'NO', label: 'Tidak' },
] as const;

export const ATTENDANCE_MODE_OPTIONS = [
  { value: 'QR', label: 'QR + GPS' },
  { value: 'TRIP', label: 'Lewat trip' },
  { value: 'NONE', label: 'Tidak diabsen' },
] as const;

export const SETTINGS = {
  'shared.reason_min_length': {
    label: 'Panjang alasan paling sedikit',
    module: 'shared',
    explain: 'Semua isian alasan di HRIS (lepas tautan, nonaktifkan, cabut izin, batalkan catatan, ubah pengaturan) harus sepanjang ini.',
    type: { kind: 'integer', min: 3, max: 100 },
    unit: 'huruf',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'settings.view', editAction: 'settings.manage', review: 'OWNER_DIRECT',
  },
  'shared.hold_seconds_consequential': {
    label: 'Jeda tombol konfirmasi berakibat',
    module: 'shared',
    explain: 'Lama tombol simpan ditahan sebelum bisa ditekan pada tindakan yang berakibat.',
    type: { kind: 'integer', min: 1, max: 10 },
    unit: 'detik',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'settings.view', editAction: 'settings.manage', review: 'OWNER_DIRECT',
  },
  'shared.new_badge_days': {
    label: 'Tanda Baru tampil',
    module: 'shared',
    explain: 'Lama tanda "Baru" tampil di menu dan bagian halaman sejak fitur itu tayang.',
    type: { kind: 'integer', min: 1, max: 30 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'settings.view', editAction: 'settings.manage', review: 'OWNER_DIRECT',
  },
  'employees.training_review_months': {
    label: 'Masa training sebelum dinilai',
    module: 'employees',
    explain: 'Orang berstatus Training masuk antrean Promosi Training setelah genap selama ini sejak tanggal bergabung.',
    type: { kind: 'integer', min: 1, max: 12 },
    unit: 'bulan',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'settings.view', editAction: 'settings.manage', review: 'OWNER_DIRECT',
  },
  'requests.overdue_days': {
    label: 'Pengajuan dianggap lama menunggu',
    module: 'requests',
    explain: 'Pengajuan yang belum diputuskan selama ini bertanda merah di Persetujuan dan tampil di "Perlu perhatian sistem" Pemilik dan GM.',
    type: { kind: 'integer', min: 1, max: 14 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'settings.view', editAction: 'settings.manage', review: 'OWNER_DIRECT',
  },
  'accounts.recovery_contact_position': {
    label: 'Penerima laporan lupa password',
    module: 'accounts',
    explain: 'Orang berjabatan ini diberi tahu saat seseorang salah mengisi lupa password berkali-kali dan saat password diganti lewat jalur itu.',
    type: { kind: 'position' },
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'settings.view', editAction: 'settings.manage', review: 'OWNER_DIRECT',
  },
  'position.backoffice_role_suggestion': {
    label: 'Saran role kasir',
    module: 'position',
    explain: 'Role yang terisi otomatis saat memberi akses kasir ke orang berjabatan ini; tetap bisa diganti.',
    type: { kind: 'choice', options: ROLE_SUGGESTIONS },
    targets: ['ALL', 'POSITION'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'position_settings.propose', editAction: 'position_settings.approve', review: 'PROPOSE_APPROVE',
  },
  'position.field_duty_auto': {
    label: 'Tugas lapangan otomatis',
    module: 'position',
    explain: 'Orang berjabatan ini otomatis boleh menyetir dan/atau ikut sebagai kenek tanpa izin per orang.',
    type: { kind: 'choice', options: FIELD_DUTIES },
    targets: ['ALL', 'POSITION'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'position_settings.propose', editAction: 'position_settings.approve', review: 'PROPOSE_APPROVE',
  },
  'position.attendance_mode': {
    label: 'Cara absen',
    module: 'position',
    explain: 'QR + GPS: masuk jadwal dan absen di cabang. Lewat trip: absen per ritase, tanpa shift. Tidak diabsen: tidak punya jadwal.',
    type: { kind: 'choice', options: ATTENDANCE_MODE_OPTIONS },
    targets: ['ALL', 'POSITION'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'position_settings.propose', editAction: 'position_settings.approve', review: 'PROPOSE_APPROVE',
  },
  'attendance.radius_m': {
    label: 'Radius absen',
    module: 'attendance',
    explain: 'Absen di luar jarak ini dari titik cabang tetap dicatat, tetapi ditandai perlu ditinjau.',
    type: { kind: 'integer', min: 10, max: 1000 },
    unit: 'meter',
    targets: ['ALL', 'BRANCH'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.earliest_in_minutes': {
    label: 'Absen masuk paling awal',
    module: 'attendance',
    explain: 'Berapa lama sebelum jam masuk shift tombol Masuk dibuka.',
    type: { kind: 'integer', min: 0, max: 720 },
    unit: 'menit',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.min_out_minutes': {
    label: 'Jeda paling cepat absen pulang',
    module: 'attendance',
    explain: 'Absen pulang baru bisa sesudah sekian lama dari absen masuk.',
    type: { kind: 'integer', min: 0, max: 240 },
    unit: 'menit',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.out_cutoff_hour': {
    label: 'Batas absen pulang hari sebelumnya',
    module: 'attendance',
    explain: 'Absen pulang sebelum jam ini (keesokan hari) masih masuk hari kerja kemarin.',
    type: { kind: 'integer', min: 0, max: 12 },
    unit: 'jam',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.photo_retention_days': {
    label: 'Foto absen disimpan',
    module: 'attendance',
    explain: 'Sesudah sekian hari foto dihapus; jam dan angkanya tetap.',
    type: { kind: 'integer', min: 1, max: 365 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.guard_minimum': {
    label: 'Jumlah penjaga paling sedikit',
    module: 'attendance',
    explain: 'Istirahat penjaga ditolak bila yang tersisa di cabang kurang dari ini.',
    type: { kind: 'integer', min: 1, max: 20 },
    unit: 'orang',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.late_tolerance_minutes': {
    label: 'Toleransi telat',
    module: 'attendance',
    explain: 'Telat sampai sekian menit dicatat tetapi tidak dipotong. Hanya kantor yang melihat tanda "dalam toleransi".',
    type: { kind: 'integer', min: 0, max: 60 },
    unit: 'menit',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.handover_min_length': {
    label: 'Panjang serah terima paling sedikit',
    module: 'attendance',
    explain: 'Isi serah terima di Laporan Pulang paling sedikit sekian huruf.',
    type: { kind: 'integer', min: 5, max: 500 },
    unit: 'huruf',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.handover_popup_days': {
    label: 'Jendela serah terima sesudah Masuk',
    module: 'attendance',
    explain: 'Serah terima yang belum dibaca muncul sebagai jendela sesudah absen Masuk selama sekian hari; yang lebih lama tetap ada di menu.',
    type: { kind: 'integer', min: 1, max: 60 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.relocation_prompt_workdays': {
    label: 'Tanya sudah pindah cabang',
    module: 'attendance',
    explain: 'Sesudah sekian hari kerja berturut-turut absen di cabang lain, orang itu ditanya apakah sudah pindah cabang.',
    type: { kind: 'integer', min: 2, max: 60 },
    unit: 'hari kerja',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.pattern_outside_count': {
    label: 'Pola: jumlah absen luar titik',
    module: 'attendance',
    explain: 'Orang yang absen di luar radius sebanyak ini dalam rentang hari kerja di bawah ditandai untuk ditinjau.',
    type: { kind: 'integer', min: 2, max: 30 },
    unit: 'kali',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.pattern_window_workdays': {
    label: 'Pola: rentang hari kerja',
    module: 'attendance',
    explain: 'Hari kerja terakhir orang itu yang dihitung untuk pola absen luar titik.',
    type: { kind: 'integer', min: 2, max: 60 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.pattern_same_point_m': {
    label: 'Pola: titik nyaris sama',
    module: 'attendance',
    explain: 'Dua orang berbeda yang absen di luar radius dari titik sedekat ini pada hari yang sama ditandai.',
    type: { kind: 'integer', min: 1, max: 100 },
    unit: 'meter',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'position.late_applies': {
    label: 'Kena telat',
    module: 'position',
    explain: 'Telat orang berjabatan ini dihitung.',
    type: { kind: 'choice', options: YES_NO },
    targets: ['ALL', 'POSITION'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'position_settings.propose', editAction: 'position_settings.approve', review: 'PROPOSE_APPROVE',
  },
  'position.break_required': {
    label: 'Wajib absen istirahat',
    module: 'position',
    explain: 'Tombol Istirahat tampil bagi jabatan ini bila shiftnya punya istirahat.',
    type: { kind: 'choice', options: YES_NO },
    targets: ['ALL', 'POSITION'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'position_settings.propose', editAction: 'position_settings.approve', review: 'PROPOSE_APPROVE',
  },
  'position.is_guard': {
    label: 'Penjaga cabang',
    module: 'position',
    explain: 'Cabang harus tetap punya penjaga saat jabatan ini istirahat.',
    type: { kind: 'choice', options: YES_NO },
    targets: ['ALL', 'POSITION'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'position_settings.propose', editAction: 'position_settings.approve', review: 'PROPOSE_APPROVE',
  },
  'position.day_off_quota': {
    label: 'Jatah libur per periode',
    module: 'position',
    explain: 'Jumlah hari libur yang dipilih sendiri tiap periode 26–25. Isi 0 untuk jabatan yang liburnya tidak tetap.',
    type: { kind: 'integer', min: 0, max: 10 },
    unit: 'hari',
    targets: ['ALL', 'POSITION'],
    affectsMoney: true, startDay: 26, mustAnnounce: true, exemptible: false,
    viewAction: 'position_settings.propose', editAction: 'position_settings.approve', review: 'PROPOSE_APPROVE',
  },
  'attendance.day_off_max_per_branch': {
    label: 'Libur bersamaan per cabang',
    module: 'attendance',
    explain: 'Paling banyak sekian orang libur di satu cabang pada tanggal yang sama. Cabang berisi 2 orang: 1; berisi 1 orang tetap boleh libur.',
    type: { kind: 'integer', min: 1, max: 20 },
    unit: 'orang',
    targets: ['ALL', 'BRANCH'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.day_off_weekend_max': {
    label: 'Libur akhir pekan per periode',
    module: 'attendance',
    explain: 'Paling banyak sekian tanggal libur jatuh di Sabtu atau Minggu dalam satu periode.',
    type: { kind: 'integer', min: 0, max: 10 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.day_off_min_gap_days': {
    label: 'Jarak antar libur',
    module: 'attendance',
    explain: 'Selisih tanggal antar hari libur paling sedikit sekian hari, termasuk terhadap libur di periode sebelum dan sesudahnya.',
    type: { kind: 'integer', min: 1, max: 15 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.day_off_window_open_day': {
    label: 'Jendela pilih libur dibuka',
    module: 'attendance',
    explain: 'Tanggal dibukanya jendela memilih libur untuk periode yang mulai tanggal 26 bulan yang sama.',
    type: { kind: 'integer', min: 1, max: 25 },
    unit: 'tanggal',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.day_off_window_close_day': {
    label: 'Jendela pilih libur ditutup',
    module: 'attendance',
    explain: 'Jendela memilih libur ditutup tanggal ini pukul 23.59. Sesudahnya hanya jalur terlambat.',
    type: { kind: 'integer', min: 1, max: 25 },
    unit: 'tanggal',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.day_off_late_min_days': {
    label: 'Pilih libur terlambat: paling cepat',
    module: 'attendance',
    explain: 'Sesudah jendela tutup, libur yang belum lengkap hanya bisa dipilih untuk tanggal sekian hari dari hari ini.',
    type: { kind: 'integer', min: 0, max: 14 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.newcomer_grace_days': {
    label: 'Orang baru: pilih libur tanpa tanda',
    module: 'attendance',
    explain: 'Orang yang mulai kerja sesudah jendela tutup boleh memilih libur dalam sekian hari pertamanya tanpa tanda tidak memilih libur.',
    type: { kind: 'integer', min: 0, max: 14 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.swap_deadline_days': {
    label: 'Batas tukar',
    module: 'attendance',
    explain: 'Ajakan tukar harus diterima paling lambat sekian hari sebelum tanggal yang lebih dekat; lewat itu batal otomatis.',
    type: { kind: 'integer', min: 0, max: 14 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.replacement_days': {
    label: 'Batas pilih libur pengganti',
    module: 'attendance',
    explain: 'Libur pengganti dipilih paling lambat sekian hari sesudah masuk di hari libur; lewat itu hangus.',
    type: { kind: 'integer', min: 1, max: 60 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.leave_annual_quota': {
    label: 'Jatah cuti tahunan',
    module: 'attendance',
    explain: 'Jatah cuti per tahun cuti, terpisah dari jatah libur. Tahun cuti dihitung dari tanggal bergabung; cuti baru ada sesudah masa kerja 1 tahun penuh. Sisa yang tidak dipakai hangus.',
    type: { kind: 'integer', min: 0, max: 30 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.leave_annual_notice_days': {
    label: 'Batas mengajukan cuti',
    module: 'attendance',
    explain: 'Cuti tahunan diajukan paling lambat sekian hari sebelum tanggal mulainya.',
    type: { kind: 'integer', min: 0, max: 60 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.leave_permit_notice_days': {
    label: 'Batas izin biasa',
    module: 'attendance',
    explain: 'Izin keperluan yang diajukan kurang dari sekian hari sebelum tanggalnya dicatat sebagai izin mendadak.',
    type: { kind: 'integer', min: 0, max: 30 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.leave_late_submit_days': {
    label: 'Batas mengajukan sakit, duka, dan izin mendadak',
    module: 'attendance',
    explain: 'Sakit, izin duka, dan izin mendadak boleh diajukan sampai sekian hari sesudah hari pertamanya.',
    type: { kind: 'integer', min: 0, max: 14 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.sick_no_letter_max_days': {
    label: 'Sakit tanpa surat paling lama',
    module: 'attendance',
    explain: 'Sakit tanpa surat dokter paling lama sekian hari kerja berturut-turut; lebih dari itu wajib dengan surat.',
    type: { kind: 'integer', min: 1, max: 14 },
    unit: 'hari kerja',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.bereavement_days': {
    label: 'Izin duka',
    module: 'attendance',
    explain: 'Izin duka (ayah, ibu, suami, istri, anak) bebas dan dibayar sekian hari kerja.',
    type: { kind: 'integer', min: 0, max: 14 },
    unit: 'hari kerja',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.doctor_letter_grace_days': {
    label: 'Batas menyusulkan surat dokter',
    module: 'attendance',
    explain: 'Surat dokter boleh menyusul paling lambat sekian hari sesudah masuk kerja kembali; lewat itu tetap sakit tanpa surat.',
    type: { kind: 'integer', min: 0, max: 14 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.clarify_deadline_days': {
    label: 'Batas menjelaskan',
    module: 'attendance',
    explain: 'Alpha, lupa absen, telat, dan pulang cepat dijelaskan paling lambat sekian hari sesudah tanggalnya, pukul 23.59. Lewat itu alpha dan telat tetap berlaku; lupa absen lewat pengajuan terlambat.',
    type: { kind: 'integer', min: 1, max: 14 },
    unit: 'hari',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.clarify_late_threshold_minutes': {
    label: 'Telat yang wajib dijelaskan',
    module: 'attendance',
    explain: 'Telat lebih dari sekian menit masuk Perlu Dijelaskan. Di bawahnya hanya dicatat.',
    type: { kind: 'integer', min: 0, max: 240 },
    unit: 'menit',
    targets: ['ALL'],
    affectsMoney: true, mustAnnounce: true, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.clarify_early_threshold_minutes': {
    label: 'Pulang cepat yang wajib dijelaskan',
    module: 'attendance',
    explain: 'Pulang cepat lebih dari sekian menit masuk Perlu Dijelaskan. Di bawahnya hanya dicatat.',
    type: { kind: 'integer', min: 0, max: 240 },
    unit: 'menit',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.absence_streak_days': {
    label: 'Tanda tidak masuk berturut-turut',
    module: 'attendance',
    explain: 'HR, Pemilik, dan GM diberi tanda bila seseorang sakit tanpa surat, izin, atau alpha sekian hari kerja berturut-turut. Tidak ada penonaktifan otomatis.',
    type: { kind: 'integer', min: 2, max: 30 },
    unit: 'hari kerja',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
  'attendance.forgot_habit_min': {
    label: 'Ambang kebiasaan lupa absen',
    module: 'attendance',
    explain: 'Orang yang lupa absen lebih dari sekian kali dalam satu periode muncul di Laporan Kebiasaan Lupa Absen.',
    type: { kind: 'integer', min: 1, max: 30 },
    unit: 'kali',
    targets: ['ALL'],
    affectsMoney: false, mustAnnounce: false, exemptible: false,
    viewAction: 'attendance.location.view', editAction: 'attendance.radius.update', review: 'OWNER_DIRECT',
  },
} as const satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTINGS;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(value: string): value is SettingKey {
  return Object.hasOwn(SETTINGS, value);
}

export function settingDefinition(key: SettingKey): SettingDefinition {
  return SETTINGS[key];
}

/** Pengaturan berbentuk tabel per jabatan tampil di layar Pengaturan Jabatan (KAR-L31), bukan di daftar umum. */
export const POSITION_SETTING_KEYS = SETTING_KEYS.filter((key) => SETTINGS[key].module === 'position');
