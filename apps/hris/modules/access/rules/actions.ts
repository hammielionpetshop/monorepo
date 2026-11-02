/**
 * Daftar tindakan bernama HRIS (KAR-63, KAR-71). Setiap pintu server memakai salah satunya.
 * Pemberian hak per jabatan adalah data (`hris.position_grants`); daftar ini hanya kode.
 * Modul berikutnya menambah tindakannya sendiri di sini beserta hak awalnya di migrasinya.
 *
 * Bendera:
 * - ownerOnly: hanya jabatan full_access (Pemilik, GM); tidak bisa diberikan ke jabatan lain.
 * - selfOnly: hanya boleh diberikan dengan lingkup "diri sendiri".
 * - highRightsOnly: hanya boleh diberikan ke jabatan bertanda berhak tinggi.
 * - selfForbidden: tidak boleh dilakukan atas dirinya sendiri, oleh siapa pun (KAR-72).
 */
export type ActionDefinition = {
  label: string;
  group: string;
  ownerOnly?: boolean;
  selfOnly?: boolean;
  highRightsOnly?: boolean;
  selfForbidden?: boolean;
};

const OWN = 'Profil & akun sendiri';
const EMPLOYEE = 'Karyawan';
const EXTRA = 'Hak tambahan';
const SESSION = 'Masuk & sesi';
const SETTINGS = 'Pengaturan & organisasi';
const ATTENDANCE = 'Kehadiran';

export const ACTIONS = {
  'profile.view': { label: 'Lihat profil', group: OWN },
  'contact.update_own': { label: 'Ubah kontak sendiri', group: OWN, selfOnly: true },
  'identity_change.request': { label: 'Ajukan ubah data diri', group: OWN, selfOnly: true },
  'own_account.manage': { label: 'Ganti password dan keluarkan perangkat sendiri', group: OWN, selfOnly: true },
  'login_history.view_own': { label: 'Lihat riwayat masuk sendiri', group: OWN, selfOnly: true },

  'employee.create': { label: 'Tambah karyawan', group: EMPLOYEE, ownerOnly: true },
  'employee.list': { label: 'Lihat daftar karyawan', group: EMPLOYEE },
  'employee.directory': { label: 'Lihat daftar karyawan terbatas (nama, cabang, jabatan, izin)', group: EMPLOYEE },
  'employee.update': { label: 'Ubah data orang', group: EMPLOYEE, selfForbidden: true },
  'identity_change.decide': { label: 'Putuskan ubah data diri', group: EMPLOYEE, selfForbidden: true },
  'placement.record': { label: 'Catat perubahan penempatan', group: EMPLOYEE, selfForbidden: true },
  'employee.activation': { label: 'Nonaktifkan / aktifkan orang', group: EMPLOYEE, selfForbidden: true },
  'resignation.set_unnotified': {
    label: 'Tetapkan berhenti tanpa pemberitahuan', group: EMPLOYEE, ownerOnly: true, selfForbidden: true,
  },
  'resignation.propose_unnotified': {
    label: 'Usulkan berhenti tanpa pemberitahuan', group: EMPLOYEE, selfForbidden: true,
  },
  'field_permit.update': { label: 'Ubah izin tugas lapangan', group: EMPLOYEE, selfForbidden: true },
  'registration.decide': { label: 'Putuskan pendaftaran', group: EMPLOYEE },
  'training_promotion.decide': { label: 'Putuskan promosi training', group: EMPLOYEE, selfForbidden: true },
  'freelancer.manage': { label: 'Kelola pekerja lepas', group: EMPLOYEE },

  'temp_report_right.grant': { label: 'Beri hak lapor sementara', group: EXTRA, selfForbidden: true },
  'temp_substitute.grant': { label: 'Beri gantikan sementara', group: EXTRA, selfForbidden: true },
  'extra_rights.view': { label: 'Lihat hak tambahan aktif', group: EXTRA },

  'sessions.revoke': { label: 'Keluarkan orang dari semua perangkat', group: SESSION, selfForbidden: true },
  'account.manage': { label: 'Buat akun, tautkan, dan lepas tautan', group: SESSION, ownerOnly: true, selfForbidden: true },
  'account.reset_password': { label: 'Reset password orang lain', group: SESSION, ownerOnly: true, selfForbidden: true },
  'backoffice_access.manage': { label: 'Beri, ubah, dan cabut akses kasir', group: SESSION, ownerOnly: true, selfForbidden: true },
  'login_history.view_all': { label: 'Lihat riwayat masuk semua orang', group: SESSION, ownerOnly: true },
  view_as: { label: 'Lihat sebagai', group: SESSION, ownerOnly: true },

  'position_settings.propose': { label: 'Usulkan Pengaturan Jabatan / pengecualian', group: SETTINGS },
  'position_settings.approve': {
    label: 'Setujui Pengaturan Jabatan / pengecualian', group: SETTINGS, ownerOnly: true, selfForbidden: true,
  },
  'settings.view': { label: 'Buka layar Pengaturan', group: SETTINGS },
  'settings.manage': { label: 'Ubah dan batalkan pengaturan (langsung berlaku)', group: SETTINGS, ownerOnly: true },
  'request_types.view': { label: 'Lihat Jenis Pengajuan', group: SETTINGS },
  'position.grants.update': { label: 'Ubah Hak Akses Jabatan', group: SETTINGS, ownerOnly: true },
  'org.manage': { label: 'Ubah cabang, departemen, jabatan', group: SETTINGS },
  'position.high_rights.update': { label: 'Ubah tanda berhak tinggi jabatan', group: SETTINGS, ownerOnly: true },
  'report_guide.view': { label: 'Baca pedoman lapor', group: SETTINGS },
  'report_guide.update': { label: 'Ubah pedoman lapor', group: SETTINGS, ownerOnly: true },

  'attendance.work_hours.view': { label: 'Lihat jam kerja cabang', group: ATTENDANCE },
  'attendance.work_hours.update': { label: 'Ubah jam kerja cabang', group: ATTENDANCE },
  'attendance.schedule.view': { label: 'Lihat jadwal dan shift', group: ATTENDANCE },
  'attendance.schedule.update': { label: 'Isi kelompok giliran dan ubah shift', group: ATTENDANCE },
  'attendance.location.view': { label: 'Lihat lokasi dan QR cabang', group: ATTENDANCE },
  'attendance.qr.manage': { label: 'Cetak dan buat ulang QR', group: ATTENDANCE },
  'attendance.radius.update': { label: 'Ubah radius absen', group: ATTENDANCE, ownerOnly: true },
  'attendance.closure.view': { label: 'Lihat hari tutup', group: ATTENDANCE },
  'attendance.closure.manage': { label: 'Pasang dan batalkan hari tutup', group: ATTENDANCE },
  'attendance.my_schedule.view': { label: 'Lihat Jadwal Saya', group: ATTENDANCE, selfOnly: true },
  'attendance.self.check': { label: 'Absen sendiri', group: ATTENDANCE, selfOnly: true },
  'attendance.assist.view': { label: 'Lihat daftar perbantuan', group: ATTENDANCE },
  'attendance.photo.view': { label: 'Lihat Foto Absen Hari Ini', group: ATTENDANCE },
  'attendance.attempts.view': { label: 'Lihat percobaan absen yang ditolak', group: ATTENDANCE },
  'attendance.review.view': { label: 'Lihat daftar tinjau absen dan tanda pola', group: ATTENDANCE },
  'attendance.review.decide': { label: 'Putuskan absen luar titik', group: ATTENDANCE, selfForbidden: true },
  'attendance.correction.create': { label: 'Koreksi absen', group: ATTENDANCE, selfForbidden: true },
  'attendance.correction.view': { label: 'Lihat riwayat koreksi absen', group: ATTENDANCE },
  'attendance.recap.view': { label: 'Lihat catatan hari kerja dan rekap orang lain', group: ATTENDANCE },
  'attendance.my_recap.view': { label: 'Lihat Kehadiran Saya', group: ATTENDANCE, selfOnly: true },
  'attendance.handover.view': { label: 'Lihat Serah Terima Tim', group: ATTENDANCE },
  'attendance.problem.read': { label: 'Baca Laporan Masalah (rahasia)', group: ATTENDANCE, ownerOnly: true },
  'attendance.dayoff.view': { label: 'Lihat Libur Cabang, belum memilih, dan laporan tukar', group: ATTENDANCE },
  'attendance.dayoff.change': { label: 'Ubah libur seseorang langsung', group: ATTENDANCE, selfForbidden: true },
  'attendance.dayoff.revoke': { label: 'Cabut libur seseorang', group: ATTENDANCE, selfForbidden: true },
  'attendance.dayoff.request_work': { label: 'Minta masuk di hari libur', group: ATTENDANCE, selfForbidden: true },
  'absence.decide': { label: 'Putuskan dan cabut izin, sakit, atau cuti; buka surat dokter', group: ATTENDANCE, selfForbidden: true },
  'absence.submit_for': { label: 'Isikan izin, sakit, atau cuti atas nama orang lain', group: ATTENDANCE, selfForbidden: true },
  'absence.adjust_leave': { label: 'Sesuaikan sisa cuti', group: ATTENDANCE, selfForbidden: true },
  'clarification.decide': { label: 'Putuskan dan cabut penjelasan (Perlu Dijelaskan); lihat alasan dan foto', group: ATTENDANCE, selfForbidden: true },
  'clarification.team.view': { label: 'Lihat Perlu Dijelaskan Tim', group: ATTENDANCE },
  'clarification.streak.seen': { label: 'Tandai tidak masuk berturut-turut sudah dilihat', group: ATTENDANCE, selfForbidden: true },
  'clarification.habit.view': { label: 'Lihat Laporan Kebiasaan Lupa Absen', group: ATTENDANCE, ownerOnly: true },
  'relocation.decide': { label: 'Putuskan usulan pindah cabang', group: ATTENDANCE, selfForbidden: true },
} as const satisfies Record<string, ActionDefinition>;

export type ActionName = keyof typeof ACTIONS;
export type ActionCatalog = Record<string, ActionDefinition>;

export const ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

export function isActionName(value: string): value is ActionName {
  return Object.hasOwn(ACTIONS, value);
}

export const SCOPES = ['SELF', 'BRANCH', 'DEPARTMENT', 'ALL'] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_LABELS: Record<Scope, string> = {
  SELF: 'Diri sendiri',
  BRANCH: 'Cabangnya',
  DEPARTMENT: 'Departemennya',
  ALL: 'Semua',
};
