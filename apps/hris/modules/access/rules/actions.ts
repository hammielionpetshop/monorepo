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
const PAYROLL = 'Gaji';
const ADVANCE = 'Kasbon';
const LOGISTICS = 'Logistik';
const DRIVER_PAY = 'Gaji Driver';
const UNLOADING = 'Bongkaran';

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
  'overtime.decide': { label: 'Sahkan, turunkan, tolak, dan cabut klaim lembur; lihat foto kertas dan yang menyuruh', group: ATTENDANCE, selfForbidden: true },
  'overtime.team.view': { label: 'Lihat Lembur Tim', group: ATTENDANCE },
  'relocation.decide': { label: 'Putuskan usulan pindah cabang', group: ATTENDANCE, selfForbidden: true },
  'salary.view': { label: 'Lihat gaji karyawan (tanpa jabatan bertanda "Gaji hanya terlihat Pemilik dan GM")', group: PAYROLL },
  'salary.propose': { label: 'Usulkan ubah gaji (tidak untuk diri sendiri)', group: PAYROLL },
  'salary.change': { label: 'Ubah gaji langsung, batalkan perubahan, dan putuskan usulan ubah gaji', group: PAYROLL, ownerOnly: true },
  'salary_components.manage': { label: 'Ubah Jenis Komponen Gaji', group: PAYROLL, ownerOnly: true },
  'salary_standard.manage': { label: 'Ubah Gaji Standar', group: PAYROLL, ownerOnly: true },
  'pay_waiver.manage': { label: 'Tiadakan potongan telat dan denda kehadiran, dan batalkan peniadaannya', group: PAYROLL, ownerOnly: true, selfForbidden: true },
  'inventory_loss.view': { label: 'Lihat Kehilangan Barang dan pembagiannya', group: PAYROLL },
  'inventory_loss.record': { label: 'Catat kehilangan barang (sebagai usulan)', group: PAYROLL },
  'cash_shortage.view': { label: 'Lihat Minus Kas (dari POS dan catat tangan)', group: PAYROLL },
  'cash_shortage.record': { label: 'Catat minus kas di luar shift POS (sebagai usulan)', group: PAYROLL },
  'cash_shortage.review': { label: 'Tinjau usulan minus kas POS dan kelola Tautan Akun Kasir', group: PAYROLL },
  'deduction.approve': { label: 'Sahkan dan batalkan kehilangan barang dan minus kas; tiadakan shift minus', group: PAYROLL, ownerOnly: true, selfForbidden: true },
  'other_deduction.view': { label: 'Lihat Potongan Lain dan tab Potongan seseorang', group: PAYROLL },
  'other_deduction.propose': { label: 'Ajukan Potongan Lain (tidak untuk diri sendiri)', group: PAYROLL },
  'other_deduction_types.manage': { label: 'Ubah Jenis Potongan Lain', group: PAYROLL, ownerOnly: true },
  'bonus.view': { label: 'Lihat Persetujuan Bonus, Buku Bonus, dan tab Bonus seseorang', group: PAYROLL },
  'bonus.view_totals': { label: 'Lihat jumlah bonus per jenis per periode (tanpa nama orang)', group: PAYROLL },
  'bonus.approve': { label: 'Sahkan dan tolak bonus grooming, batalkan bonus, putuskan perubahan dari kasir', group: PAYROLL, selfForbidden: true },
  'bonus.sync': { label: 'Tarik data bonus dari kasir sekarang', group: PAYROLL },
  'pos_groomer_link.manage': { label: 'Pasangkan groomer dan pengantar kasir ke karyawan', group: PAYROLL, ownerOnly: true },
  'bonus.record_free': { label: 'Catat Bonus Bebas (HR sebagai usulan; tidak untuk diri sendiri)', group: PAYROLL },
  'bonus.approve_free': { label: 'Sahkan, tolak, dan batalkan Bonus Bebas', group: PAYROLL, ownerOnly: true, selfForbidden: true },
  'fund.view': { label: 'Lihat Dana Disiplin dan Dana Tidak Hadir', group: PAYROLL },
  'fund.manage': { label: 'Isi saldo awal, sesuaikan, dan pindahkan Dana Disiplin dan Dana Tidak Hadir', group: PAYROLL, ownerOnly: true },
  'payslip.view': { label: 'Buka Periode Slip dan slip seseorang, cetak slip yang ditutup (tanpa jabatan bertanda "Gaji hanya terlihat Pemilik dan GM")', group: PAYROLL },
  'payslip.view_periods': { label: 'Lihat daftar Periode Slip (tanggal dan status, tanpa nominal)', group: PAYROLL },
  'payslip.close': { label: 'Tutup slip dan Tutup semua yang siap', group: PAYROLL },
  'payslip.reopen': { label: 'Buka kembali slip yang ditutup dan putuskan Minta buka kembali', group: PAYROLL, ownerOnly: true },
  'payslip.request_reopen': { label: 'Minta buka kembali slip yang ditutup (diputus Pemilik atau GM)', group: PAYROLL },
  'payslip.early_close': { label: 'Tutup lebih cepat slip terakhir orang yang berhenti', group: PAYROLL, ownerOnly: true },
  'receivable.view': { label: 'Lihat Piutang Lain', group: PAYROLL },
  'receivable.manage': { label: 'Hapuskan Piutang Lain dan Hapuskan sisa Potongan Lain', group: PAYROLL, ownerOnly: true },
  'payslip.pay': { label: 'Bayar slip yang ditutup (tidak untuk slip sendiri kecuali GM)', group: PAYROLL, ownerOnly: true },
  'payslip.cancel_payment': { label: 'Batalkan pembayaran slip', group: PAYROLL, ownerOnly: true },
  'pay_schedule.view': { label: 'Lihat Jadwal Bayar (tanpa hak Bayar: jumlah slip per periode tanpa nama)', group: PAYROLL },
  'transfer_list.view': { label: 'Lihat dan unduh Daftar Transfer slip yang belum Dibayar (tanpa jabatan bertanda)', group: PAYROLL },
  'payment_sources.manage': { label: 'Ubah daftar Sumber Uang pembayaran gaji', group: PAYROLL, ownerOnly: true },
  'payslip_objection.decide': { label: 'Putuskan keberatan slip "Ada yang salah" (tanpa jabatan bertanda) dan tautkan pembetulannya', group: PAYROLL, selfForbidden: true },
  'payslip_objection.decide_owner': { label: 'Putuskan keberatan slip "Uang belum saya terima" dan keberatan slip jabatan bertanda', group: PAYROLL, ownerOnly: true, selfForbidden: true },
  'payroll_summary.view': { label: 'Lihat Ringkasan Gaji per periode (HR tanpa jabatan bertanda; Finance total perusahaan saja)', group: PAYROLL },
  'payroll_totals.view': { label: 'Lihat Total Diterima per Orang dan unduh CSV-nya (HR tanpa jabatan bertanda)', group: PAYROLL },
  'advance.view': { label: 'Lihat daftar dan rincian kasbon (tanpa sisa Dana Kasbon)', group: ADVANCE },
  'advance.fill_for': { label: 'Isikan pengajuan kasbon atas nama karyawan (bukan untuk diri sendiri)', group: ADVANCE, selfForbidden: true },
  'advance.review': { label: 'Periksa pengajuan kasbon dan usulkan angka (tidak menolak, tidak menyetujui)', group: ADVANCE, selfForbidden: true },
  'advance.decide': { label: 'Setujui atau tolak kasbon dan putuskan permintaan kasbon', group: ADVANCE, ownerOnly: true, selfForbidden: true },
  'advance.hand_over': { label: 'Serahkan uang kasbon yang sudah disetujui', group: ADVANCE },
  'advance.cancel': { label: 'Batalkan kasbon yang belum diberikan dan batal serah uang', group: ADVANCE, ownerOnly: true },
  'advance.funds.view': { label: 'Lihat sisa Dana Kasbon', group: ADVANCE, ownerOnly: true },
  'advance.repay': { label: 'Terima pelunasan tunai kasbon (bukan kasbon sendiri kecuali Pemilik/GM)', group: ADVANCE },
  'advance.manage': { label: 'Ubah jadwal cicilan, hapus utang kasbon, batalkan pelunasan atau hapus, dan buat Kasbon Khusus', group: ADVANCE, ownerOnly: true, selfForbidden: true },
  'advance.legacy_enter': { label: 'Ketik sisa kasbon bawaan sistem lama untuk disahkan Pemilik atau GM (bukan untuk diri sendiri)', group: ADVANCE },
  'migration.readiness_view': { label: 'Lihat Siap Pindah (daftar periksa sebelum hari pindah)', group: SETTINGS, ownerOnly: true },
  'migration.comparison': { label: 'Uji banding: Lembar Banding, hitung, dan sebab selisih', group: SETTINGS, ownerOnly: true },
  'logistics.fleet.manage': { label: 'Ubah daftar Mobil & Rute (tambah, ubah, nonaktifkan)', group: LOGISTICS },
  'logistics.trip.view': { label: 'Lihat trip dan rinciannya', group: LOGISTICS },
  'logistics.trip.manage': { label: 'Buat, ubah, batalkan trip, dan tutup trip atas nama driver', group: LOGISTICS },
  'logistics.wage.view': { label: 'Lihat ritase dan upah belanja per orang', group: LOGISTICS },
  'logistics.wage.manage': { label: 'Batalkan ritase dan catat ritase tangan', group: LOGISTICS, ownerOnly: true },
  'logistics.fence.manage': { label: 'Matikan sementara pemeriksaan titik garasi (pagar uji)', group: LOGISTICS, ownerOnly: true },
  'logistics.delivery_note.view': { label: 'Lihat Surat Jalan (nota dan PO Internal yang dikirim truk Gudang)', group: LOGISTICS },
  'logistics.store.view': { label: 'Lihat Data Toko (rute bawaan dan catatan pengiriman)', group: LOGISTICS },
  'logistics.store.manage': { label: 'Ubah rute bawaan dan catatan pengiriman toko', group: LOGISTICS },
  'logistics.delivery_note.decide': { label: 'Putuskan surat jalan Gagal: Kirim ulang atau Batal', group: LOGISTICS },
  'logistics.vehicle_followup.manage': { label: 'Tindak lanjuti Laporan Pulang driver: Sudah diisi bensin, mobil perlu perhatian Selesai', group: LOGISTICS },
  'attendance.trip.view': { label: 'Lihat Absen Trip Hari Ini (tanpa foto awak)', group: ATTENDANCE },
  'attendance.trip.photo': { label: 'Lihat foto awak di Absen Trip Hari Ini', group: ATTENDANCE },
  'wage.rate.view': { label: 'Lihat Tarif Ritase dan Jenis Upah', group: DRIVER_PAY },
  'wage.rate.manage': { label: 'Tarif baru, batalkan tarif terjadwal, dan betulkan salah ketik tarif', group: DRIVER_PAY, ownerOnly: true },
  'wage.trip.view': { label: 'Lihat Upah Ritase per orang (tanpa jabatan bertanda "Gaji hanya terlihat Pemilik dan GM")', group: DRIVER_PAY },
  'wage.trip.review': { label: 'Tandai Sudah dilihat pada upah ritase Perlu dilihat', group: DRIVER_PAY },
  'fine.propose': { label: 'Ajukan denda driver & kenek (Kepala Gudang = usulan; Pemilik/GM langsung berlaku)', group: DRIVER_PAY },
  'fine.view': { label: 'Lihat semua Denda Driver & Kenek dan Jenis Denda', group: DRIVER_PAY },
  'fine.decide': { label: 'Sahkan atau tolak usulan denda driver & kenek', group: DRIVER_PAY, ownerOnly: true, selfForbidden: true },
  'fine.cancel': { label: 'Batalkan atau tiadakan denda driver & kenek', group: DRIVER_PAY, ownerOnly: true, selfForbidden: true },
  'fine_kind.manage': { label: 'Tambah jenis denda, ubah nominal, dan nonaktifkan jenis denda', group: DRIVER_PAY, ownerOnly: true },
  'unloading.view': { label: 'Lihat Laporan Bongkaran, bagian tiap peserta, dan Berat per Satuan', group: UNLOADING },
  'unloading.create': { label: 'Buat, koreksi, dan batalkan Laporan Bongkaran yang belum dibayar; ubah berat per satuan', group: UNLOADING },
  'unloading.decide': { label: 'Setujui atau tolak Laporan Bongkaran terlambat', group: UNLOADING, ownerOnly: true },
  'unloading.weight_review': { label: 'Tandai Sudah dilihat pada perubahan berat per satuan', group: UNLOADING, ownerOnly: true },
  'unloading.other_item_link': { label: 'Pasangkan Barang lain ke produk kasir', group: UNLOADING, ownerOnly: true },
  'unloading.review_day': { label: 'Tandai Sudah dilihat pada peserta bongkaran yang hari itu izin, sakit, cuti, atau alpha', group: UNLOADING },
  'unloading.pay': { label: 'Bayar bongkaran, tanyakan dulu, dan terima pengembalian lebih bayar (bukan laporan yang ia buat atau ikuti)', group: UNLOADING },
  'unloading.correct_paid': { label: 'Koreksi dan batalkan Laporan Bongkaran yang sudah dibayar', group: UNLOADING, ownerOnly: true },
  'unloading.cancel_payment': { label: 'Batal bayar bongkaran', group: UNLOADING, ownerOnly: true },
  'unloading.overpay_decide': { label: 'Putuskan lebih bayar bongkaran: tagih tunai atau hapus', group: UNLOADING, ownerOnly: true },
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
