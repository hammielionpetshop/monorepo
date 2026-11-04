import type { NavIconName } from '@/components/nav-links';
import type { ActionName } from '@/modules/access';

/**
 * Daftar menu HRIS, dikelompokkan. Satu tempat; tiap modul menambah barisnya di kelompok yang sesuai.
 * `action` = tindakan bernama yang dibutuhkan; menu tanpa `action` tampil untuk semua yang punya
 * akses HRIS. Menu yang tersembunyi bukan penjaga: halamannya tetap memeriksa di server (SIS-36).
 * `mobile` = ikut jadi pintasan di bilah bawah HP; menu lain dibuka lewat tombol Menu.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  action?: ActionName | ActionName[];
  mobile?: boolean;
  /** Angka penanda di samping menu (dihitung kerangka aplikasi tiap permintaan). */
  count?: NavCountKey;
};

export type NavCountKey = 'approvals' | 'notifications' | 'clarifications' | 'overtime';
export type NavCounts = Partial<Record<NavCountKey, number>>;

/**
 * Tindakan "putuskan"/"periksa" semua jenis pengajuan (pemegang salah satunya melihat menu Persetujuan).
 * Ditulis di sini karena berkas ini ikut ke browser; tes menyamakannya dengan `deciderActions()` di modul requests.
 */
export const APPROVAL_ACTIONS: ActionName[] = ['identity_change.decide', 'position_settings.approve', 'relocation.decide', 'absence.decide', 'clarification.decide', 'overtime.decide', 'salary.change', 'deduction.approve', 'bonus.approve_free', 'payslip.reopen', 'payslip_objection.decide', 'payslip_objection.decide_owner', 'advance.decide', 'advance.review', 'fine.decide', 'unloading.decide'];

/** Kelompok tanpa `label` selalu terbuka (tidak bisa dilipat). */
export type NavGroup = { id: string; label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'main',
    items: [
      { href: '/', label: 'Beranda', icon: 'home', mobile: true },
      { href: '/absen', label: 'Absen', icon: 'check', action: 'attendance.self.check', mobile: true },
      // Driver dan kenek (absen lewat trip) atau orang yang sedang ditugaskan di trip; disaring kerangka aplikasi (spec L6 §4).
      { href: '/trip-saya', label: 'Trip Saya', icon: 'truck', mobile: true },
      { href: '/pemberitahuan', label: 'Pemberitahuan', icon: 'bell', mobile: true, count: 'notifications' },
    ],
  },
  {
    id: 'self',
    label: 'Saya',
    items: [
      { href: '/pengajuan', label: 'Pengajuan Saya', icon: 'inbox', mobile: true },
      { href: '/jadwal', label: 'Jadwal Saya', icon: 'calendar', action: 'attendance.my_schedule.view', mobile: true },
      { href: '/libur', label: 'Pilih Libur', icon: 'calendar', action: 'attendance.self.check' },
      { href: '/tukar', label: 'Tukar Libur & Shift', icon: 'users', action: 'attendance.self.check' },
      { href: '/perlu-dijelaskan', label: 'Perlu Dijelaskan', icon: 'shield', action: 'attendance.self.check', count: 'clarifications' },
      { href: '/lembur', label: 'Lembur Saya', icon: 'check', action: 'attendance.self.check', count: 'overtime' },
      { href: '/tidak-masuk/ajukan', label: 'Ajukan Izin, Sakit, Cuti', icon: 'inbox', action: 'attendance.self.check' },
      { href: '/cuti', label: 'Sisa Cuti Saya', icon: 'calendar', action: 'attendance.self.check' },
      { href: '/tidak-masuk/surat-dokter', label: 'Susulkan Surat Dokter', icon: 'check', action: 'attendance.self.check' },
      { href: '/kehadiran-saya', label: 'Kehadiran Saya', icon: 'history', action: 'attendance.my_recap.view' },
      { href: '/pendapatan', label: 'Pendapatan Saya', icon: 'table', action: 'profile.view' },
      { href: '/kasbon', label: 'Kasbon Saya', icon: 'inbox', action: 'profile.view' },
      { href: '/serah-terima', label: 'Serah Terima Saya', icon: 'inbox', action: 'attendance.self.check' },
      { href: '/lapor-masalah', label: 'Lapor Masalah', icon: 'shield', action: 'attendance.self.check' },
      { href: '/profil', label: 'Profil saya', icon: 'user', action: 'profile.view' },
    ],
  },
  {
    id: 'office',
    label: 'Kantor',
    items: [
      { href: '/persetujuan', label: 'Persetujuan', icon: 'check', action: APPROVAL_ACTIONS, count: 'approvals' },
      { href: '/gaji', label: 'Gaji Karyawan', icon: 'table', action: ['salary.view', 'salary.change'] },
      { href: '/gaji/periode', label: 'Periode Slip', icon: 'list', action: ['payslip.view', 'payslip.view_periods'] },
      { href: '/gaji/jadwal-bayar', label: 'Jadwal Bayar', icon: 'history', action: ['payslip.pay', 'pay_schedule.view'] },
      { href: '/gaji/total-diterima', label: 'Total Diterima per Orang', icon: 'table', action: 'payroll_totals.view' },
      { href: '/gaji/uji-banding', label: 'Uji Banding', icon: 'table', action: 'migration.comparison' },
      { href: '/gaji/kasbon', label: 'Kasbon', icon: 'list', action: ['advance.view', 'advance.review', 'advance.hand_over', 'advance.decide', 'advance.repay'] },
      { href: '/gaji/upah-ritase', label: 'Upah Ritase', icon: 'table', action: 'wage.trip.view' },
      { href: '/gaji/denda-driver', label: 'Denda Driver & Kenek', icon: 'list', action: ['fine.propose', 'fine.view', 'fine.decide'] },
      { href: '/gaji/bongkaran', label: 'Laporan Bongkaran', icon: 'truck', action: ['unloading.view', 'unloading.create', 'unloading.decide'] },
      { href: '/gaji/piutang', label: 'Piutang Lain', icon: 'table', action: ['receivable.view', 'receivable.manage'] },
      { href: '/gaji/tiadakan', label: 'Tiadakan Potongan', icon: 'shield', action: ['salary.view', 'pay_waiver.manage'] },
      { href: '/potongan/kehilangan-barang', label: 'Kehilangan Barang', icon: 'list', action: ['inventory_loss.view', 'deduction.approve'] },
      { href: '/potongan/minus-kas', label: 'Minus Kas', icon: 'table', action: ['cash_shortage.view', 'deduction.approve'] },
      { href: '/potongan/lain', label: 'Potongan Lain', icon: 'list', action: ['other_deduction.view', 'deduction.approve'] },
      { href: '/bonus/persetujuan', label: 'Persetujuan Bonus', icon: 'check', action: 'bonus.view' },
      { href: '/bonus/buku', label: 'Buku Bonus', icon: 'table', action: ['bonus.view', 'bonus.view_totals'] },
      { href: '/dana', label: 'Dana Disiplin & Tidak Hadir', icon: 'table', action: 'fund.view' },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistik',
    items: [
      { href: '/logistik/trip', label: 'Trip', icon: 'truck', action: 'logistics.trip.view' },
      { href: '/logistik/ritase', label: 'Ritase', icon: 'table', action: 'logistics.wage.view' },
      { href: '/logistik/surat-jalan', label: 'Surat Jalan', icon: 'list', action: 'logistics.delivery_note.view' },
      { href: '/logistik/toko', label: 'Data Toko', icon: 'users', action: 'logistics.store.view' },
      { href: '/logistik/bensin-mobil', label: 'Bensin & Mobil', icon: 'truck', action: 'logistics.vehicle_followup.manage' },
      { href: '/logistik/mobil-rute', label: 'Mobil & Rute', icon: 'list', action: ['logistics.fleet.manage', 'logistics.trip.view'] },
    ],
  },
  {
    id: 'employees',
    label: 'Karyawan',
    items: [
      { href: '/karyawan', label: 'Karyawan', icon: 'users', action: ['employee.list', 'employee.directory'] },
      { href: '/karyawan/pekerja-lepas', label: 'Pekerja Lepas', icon: 'users', action: ['freelancer.manage', 'unloading.create'] },
    ],
  },
  {
    id: 'attendance',
    label: 'Kehadiran',
    items: [
      { href: '/kehadiran/jadwal', label: 'Jadwal & Shift', icon: 'calendar', action: 'attendance.schedule.view' },
      { href: '/kehadiran/libur', label: 'Libur Cabang', icon: 'calendar', action: 'attendance.dayoff.view' },
      { href: '/kehadiran/minta-masuk', label: 'Minta Masuk di Hari Libur', icon: 'inbox', action: 'attendance.dayoff.request_work' },
      { href: '/kehadiran/isikan', label: 'Isikan Pengajuan atas Nama', icon: 'user', action: 'absence.submit_for' },
      { href: '/kehadiran/hari-tutup', label: 'Hari Tutup', icon: 'list', action: 'attendance.closure.view' },
      { href: '/kehadiran/qr', label: 'Lokasi & QR Cabang', icon: 'grid', action: 'attendance.location.view' },
      { href: '/kehadiran/perbantuan', label: 'Daftar Perbantuan', icon: 'users', action: 'attendance.assist.view' },
      { href: '/kehadiran/foto-hari-ini', label: 'Foto Absen Hari Ini', icon: 'user', action: 'attendance.photo.view' },
      { href: '/kehadiran/absen-trip', label: 'Absen Trip', icon: 'truck', action: 'attendance.trip.view' },
      { href: '/kehadiran/tinjau', label: 'Tinjau Absen', icon: 'shield', action: 'attendance.review.view' },
      { href: '/kehadiran/koreksi', label: 'Koreksi Absen', icon: 'sliders', action: ['attendance.correction.create', 'attendance.correction.view'] },
      { href: '/kehadiran/catatan-hari', label: 'Catatan Hari Kerja', icon: 'list', action: 'attendance.recap.view' },
      { href: '/kehadiran/rekap', label: 'Rekap Kehadiran', icon: 'table', action: 'attendance.recap.view' },
      { href: '/kehadiran/perlu-dijelaskan', label: 'Perlu Dijelaskan Tim', icon: 'shield', action: 'clarification.team.view' },
      { href: '/kehadiran/lembur', label: 'Lembur Tim', icon: 'table', action: 'overtime.team.view' },
      { href: '/kehadiran/kebiasaan-lupa-absen', label: 'Kebiasaan Lupa Absen', icon: 'table', action: 'clarification.habit.view' },
      { href: '/kehadiran/serah-terima', label: 'Serah Terima Tim', icon: 'inbox', action: 'attendance.handover.view' },
      { href: '/kehadiran/laporan-masalah', label: 'Laporan Masalah', icon: 'shield', action: 'attendance.problem.read' },
    ],
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    items: [
      { href: '/pengaturan/jam-kerja', label: 'Jam Kerja Cabang', icon: 'history', action: 'attendance.work_hours.view' },
      { href: '/pengaturan/organisasi', label: 'Cabang & Jabatan', icon: 'building', action: 'org.manage' },
      { href: '/pengaturan/hak-akses', label: 'Hak Akses Jabatan', icon: 'shield', action: 'position.grants.update' },
      { href: '/pengaturan/jabatan', label: 'Pengaturan Jabatan', icon: 'table', action: ['position_settings.propose', 'position_settings.approve'] },
      { href: '/pengaturan/umum', label: 'Pengaturan', icon: 'sliders', action: 'settings.view' },
      { href: '/pengaturan/siap-pindah', label: 'Siap Pindah', icon: 'list', action: 'migration.readiness_view' },
      { href: '/pengaturan/jenis-pengajuan', label: 'Jenis Pengajuan', icon: 'list', action: 'request_types.view' },
      { href: '/pengaturan/komponen-gaji', label: 'Jenis Komponen Gaji', icon: 'list', action: ['salary.view', 'salary_components.manage'] },
      { href: '/pengaturan/gaji-standar', label: 'Gaji Standar', icon: 'sliders', action: ['salary.view', 'salary_standard.manage'] },
      { href: '/pengaturan/potongan-lembur', label: 'Potongan & Lembur', icon: 'sliders', action: ['settings.view', 'settings.manage'] },
      { href: '/pengaturan/tanggungan-kehilangan', label: 'Tanggungan Kehilangan', icon: 'sliders', action: ['inventory_loss.view', 'settings.manage'] },
      { href: '/pengaturan/jenis-potongan-lain', label: 'Jenis Potongan Lain', icon: 'list', action: ['other_deduction.view', 'other_deduction_types.manage'] },
      { href: '/pengaturan/jenis-bonus', label: 'Jenis Bonus', icon: 'list', action: ['bonus.view', 'settings.manage'] },
      { href: '/pengaturan/sumber-uang', label: 'Sumber Uang', icon: 'list', action: 'payment_sources.manage' },
      { href: '/pengaturan/tarif-ritase', label: 'Tarif Ritase', icon: 'list', action: 'wage.rate.view' },
      { href: '/pengaturan/jenis-upah', label: 'Jenis Upah', icon: 'list', action: 'wage.rate.view' },
      { href: '/pengaturan/jenis-denda', label: 'Jenis Denda', icon: 'list', action: ['fine.view', 'fine.propose', 'fine_kind.manage'] },
      { href: '/bonus/pasangkan', label: 'Pasangkan Groomer', icon: 'users', action: ['bonus.view', 'pos_groomer_link.manage'] },
    ],
  },
  {
    id: 'guide',
    label: 'Panduan',
    items: [{ href: '/panduan/aturan-potongan', label: 'Aturan Potongan', icon: 'list' }],
  },
  {
    id: 'system',
    label: 'Sistem',
    items: [
      { href: '/akun', label: 'Akun & Tautan', icon: 'key', action: 'account.manage' },
      { href: '/riwayat-masuk', label: 'Riwayat Masuk', icon: 'history', action: 'login_history.view_all' },
      { href: '/apa-yang-baru', label: 'Apa yang baru', icon: 'sparkle' },
    ],
  },
  {
    id: 'developer',
    label: 'Pengembang',
    items: [{ href: '/komponen', label: 'Komponen', icon: 'grid' }],
  },
];

/** Bilah bawah HP memuat paling banyak sekian tombol (termasuk tombol Menu). */
export const MOBILE_BAR_SLOTS = 4;

/**
 * Menu yang boleh dilihat, kelompok kosong dibuang. Tanpa pemeriksa hak, menu ber-`action`
 * tersembunyi (gagal tertutup). Daftar tindakan = cukup salah satu.
 */
export function visibleNav(canDo?: (action: ActionName) => boolean, groups: NavGroup[] = NAV_GROUPS): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.action) return true;
        if (!canDo) return false;
        return (Array.isArray(item.action) ? item.action : [item.action]).some(canDo);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Isi bilah bawah HP. Bila semua menu muat, semuanya tampil tanpa tombol Menu;
 * bila tidak, pintasan `mobile` (maksimal slot − 1) + tombol Menu.
 */
export function mobileBar(groups: NavGroup[]): { items: NavItem[]; showMenu: boolean } {
  const all = groups.flatMap((group) => group.items);
  if (all.length <= MOBILE_BAR_SLOTS) return { items: all, showMenu: false };
  return { items: all.filter((item) => item.mobile).slice(0, MOBILE_BAR_SLOTS - 1), showMenu: true };
}

function matchesPath(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Menu aktif = yang cocok paling panjang (mis. /gaji/tiadakan tidak ikut menyalakan /gaji). */
export function isActivePath(pathname: string, href: string) {
  if (!matchesPath(pathname, href)) return false;
  return !NAV_GROUPS.some((group) => group.items.some((item) => item.href.length > href.length && matchesPath(pathname, item.href)));
}
