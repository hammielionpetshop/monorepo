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
