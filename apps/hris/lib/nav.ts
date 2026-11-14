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
      { href: '/clock-in', label: 'Absen', icon: 'check', action: 'attendance.self.check', mobile: true },
      // Driver dan kenek (absen lewat trip) atau orang yang sedang ditugaskan di trip; disaring kerangka aplikasi (spec L6 §4).
      { href: '/my-trips', label: 'Trip Saya', icon: 'truck', mobile: true },
      { href: '/notifications', label: 'Pemberitahuan', icon: 'bell', mobile: true, count: 'notifications' },
    ],
  },
  {
    id: 'self',
    label: 'Saya',
    items: [
      { href: '/requests', label: 'Pengajuan Saya', icon: 'inbox', mobile: true },
      { href: '/schedule', label: 'Jadwal Saya', icon: 'calendar', action: 'attendance.my_schedule.view', mobile: true },
      { href: '/days-off', label: 'Pilih Libur', icon: 'calendar', action: 'attendance.self.check' },
      { href: '/swaps', label: 'Tukar Libur & Shift', icon: 'users', action: 'attendance.self.check' },
      { href: '/clarifications', label: 'Perlu Dijelaskan', icon: 'shield', action: 'attendance.self.check', count: 'clarifications' },
      { href: '/overtime', label: 'Lembur Saya', icon: 'check', action: 'attendance.self.check', count: 'overtime' },
      { href: '/absence/submit', label: 'Ajukan Izin, Sakit, Cuti', icon: 'inbox', action: 'attendance.self.check' },
      { href: '/leave', label: 'Sisa Cuti Saya', icon: 'calendar', action: 'attendance.self.check' },
      { href: '/absence/doctor-notes', label: 'Susulkan Surat Dokter', icon: 'check', action: 'attendance.self.check' },
      { href: '/my-attendance', label: 'Kehadiran Saya', icon: 'history', action: 'attendance.my_recap.view' },
      { href: '/earnings', label: 'Pendapatan Saya', icon: 'table', action: 'profile.view' },
      { href: '/advances', label: 'Kasbon Saya', icon: 'inbox', action: 'profile.view' },
      { href: '/handovers', label: 'Serah Terima Saya', icon: 'inbox', action: 'attendance.self.check' },
      { href: '/report-problem', label: 'Lapor Masalah', icon: 'shield', action: 'attendance.self.check' },
      { href: '/profile', label: 'Profil saya', icon: 'user', action: 'profile.view' },
    ],
  },
  {
    id: 'office',
    label: 'Kantor',
    items: [
      { href: '/approvals', label: 'Persetujuan', icon: 'check', action: APPROVAL_ACTIONS, count: 'approvals' },
      { href: '/payroll', label: 'Gaji Karyawan', icon: 'table', action: ['salary.view', 'salary.change'] },
      { href: '/payroll/periods', label: 'Periode Slip', icon: 'list', action: ['payslip.view', 'payslip.view_periods'] },
      { href: '/payroll/pay-schedule', label: 'Jadwal Bayar', icon: 'history', action: ['payslip.pay', 'pay_schedule.view'] },
      { href: '/payroll/total-received', label: 'Total Diterima per Orang', icon: 'table', action: 'payroll_totals.view' },
      { href: '/payroll/comparison', label: 'Uji Banding', icon: 'table', action: 'migration.comparison' },
      { href: '/payroll/advances', label: 'Kasbon', icon: 'list', action: ['advance.view', 'advance.review', 'advance.hand_over', 'advance.decide', 'advance.repay'] },
      { href: '/payroll/trip-wages', label: 'Upah Ritase', icon: 'table', action: 'wage.trip.view' },
      { href: '/payroll/driver-fines', label: 'Denda Driver & Kenek', icon: 'list', action: ['fine.propose', 'fine.view', 'fine.decide'] },
      { href: '/payroll/unloading', label: 'Laporan Bongkaran', icon: 'truck', action: ['unloading.view', 'unloading.create', 'unloading.decide'] },
      { href: '/payroll/receivables', label: 'Piutang Lain', icon: 'table', action: ['receivable.view', 'receivable.manage'] },
      { href: '/payroll/waivers', label: 'Tiadakan Potongan', icon: 'shield', action: ['salary.view', 'pay_waiver.manage'] },
      { href: '/deductions/lost-items', label: 'Kehilangan Barang', icon: 'list', action: ['inventory_loss.view', 'deduction.approve'] },
      { href: '/deductions/cash-shortages', label: 'Minus Kas', icon: 'table', action: ['cash_shortage.view', 'deduction.approve'] },
      { href: '/deductions/other', label: 'Potongan Lain', icon: 'list', action: ['other_deduction.view', 'deduction.approve'] },
      { href: '/bonuses/approvals', label: 'Persetujuan Bonus', icon: 'check', action: 'bonus.view' },
      { href: '/bonuses/ledger', label: 'Buku Bonus', icon: 'table', action: ['bonus.view', 'bonus.view_totals'] },
      { href: '/funds', label: 'Dana Disiplin & Tidak Hadir', icon: 'table', action: 'fund.view' },
    ],
  },
  {
    id: 'logistics',
    label: 'Logistik',
    items: [
      { href: '/logistics/dashboard', label: 'Dashboard Logistik', icon: 'table', action: ['logistics.dashboard.view', 'logistics.money_check.do', 'logistics.store_payment.view', 'logistics.vehicle_followup.manage', 'logistics.fuel.record'] },
      { href: '/logistics/trips', label: 'Trip', icon: 'truck', action: 'logistics.trip.view' },
      { href: '/logistics/trip-counts', label: 'Ritase', icon: 'table', action: 'logistics.wage.view' },
      { href: '/logistics/delivery-notes', label: 'Surat Jalan', icon: 'list', action: 'logistics.delivery_note.view' },
      { href: '/logistics/stores', label: 'Data Toko', icon: 'users', action: 'logistics.store.view' },
      { href: '/logistics/store-money', label: 'Uang dari Toko', icon: 'table', action: 'logistics.store_payment.view' },
      { href: '/logistics/store-deposits', label: 'Titipan Toko', icon: 'table', action: ['logistics.money_check.do', 'logistics.store_payment.view'] },
      { href: '/logistics/money-checks', label: 'Terima Uang', icon: 'table', action: ['logistics.money_check.do', 'logistics.store_payment.view', 'other_deduction.propose'] },
      { href: '/logistics/store-reports', label: 'Laporan Toko', icon: 'list', action: 'logistics.delivery_note.view' },
      { href: '/logistics/load-reports', label: 'Laporan Muat Toko', icon: 'list', action: ['logistics.load_report.create', 'logistics.load_report.view'] },
      { href: '/logistics/self-delivery', label: 'Antar Sendiri', icon: 'truck', action: ['logistics.self_delivery.run', 'logistics.self_delivery.cash_receive', 'logistics.self_delivery.view'] },
      { href: '/logistics/self-delivery/office', label: 'Antar Sendiri · Kantor', icon: 'list', action: ['logistics.self_delivery.view', 'logistics.self_delivery.manage'] },
      { href: '/logistics/cashier-entries', label: 'Perlu dicatat di kasir', icon: 'list', action: 'logistics.note_cut.decide' },
      { href: '/logistics/return-pickups', label: 'Jemput Retur', icon: 'truck', action: ['logistics.return_pickup.manage', 'logistics.trip.manage', 'logistics.trip.view'] },
      { href: '/logistics/returned-goods', label: 'Barang Kembali', icon: 'truck', action: ['logistics.returned_goods.receive', 'logistics.trip.view'] },
      { href: '/logistics/fuel', label: 'Bensin & Mobil', icon: 'truck', action: ['logistics.vehicle_followup.manage', 'logistics.fuel.record'] },
      { href: '/logistics/off-site', label: 'Di Luar Titik', icon: 'list', action: 'logistics.outside_point.review' },
      { href: '/logistics/reports', label: 'Laporan Logistik', icon: 'table', action: 'logistics.report.view' },
      { href: '/logistics/vehicle-rental', label: 'Sewa Mobil', icon: 'table', action: ['logistics.vehicle_rental.view', 'logistics.vehicle_rental.pay'] },
      { href: '/logistics/vehicles-routes', label: 'Mobil & Rute', icon: 'list', action: ['logistics.fleet.manage', 'logistics.trip.view'] },
    ],
  },
  {
    id: 'employees',
    label: 'Karyawan',
    items: [
      { href: '/employees', label: 'Karyawan', icon: 'users', action: ['employee.list', 'employee.directory'] },
      { href: '/employees/casual-workers', label: 'Pekerja Lepas', icon: 'users', action: ['freelancer.manage', 'unloading.create'] },
    ],
  },
  {
    id: 'attendance',
    label: 'Kehadiran',
    items: [
      { href: '/attendance/schedule', label: 'Jadwal & Shift', icon: 'calendar', action: 'attendance.schedule.view' },
      { href: '/attendance/days-off', label: 'Libur Cabang', icon: 'calendar', action: 'attendance.dayoff.view' },
      { href: '/attendance/work-requests', label: 'Minta Masuk di Hari Libur', icon: 'inbox', action: 'attendance.dayoff.request_work' },
      { href: '/attendance/on-behalf', label: 'Isikan Pengajuan atas Nama', icon: 'user', action: 'absence.submit_for' },
      { href: '/attendance/closed-days', label: 'Hari Tutup', icon: 'list', action: 'attendance.closure.view' },
      { href: '/attendance/qr', label: 'Lokasi & QR Cabang', icon: 'grid', action: 'attendance.location.view' },
      { href: '/attendance/assistance', label: 'Daftar Perbantuan', icon: 'users', action: 'attendance.assist.view' },
      { href: '/attendance/todays-photos', label: 'Foto Absen Hari Ini', icon: 'user', action: 'attendance.photo.view' },
      { href: '/attendance/trip-attendance', label: 'Absen Trip', icon: 'truck', action: 'attendance.trip.view' },
      { href: '/attendance/review', label: 'Tinjau Absen', icon: 'shield', action: 'attendance.review.view' },
      { href: '/attendance/corrections', label: 'Koreksi Absen', icon: 'sliders', action: ['attendance.correction.create', 'attendance.correction.view'] },
      { href: '/attendance/day-notes', label: 'Catatan Hari Kerja', icon: 'list', action: 'attendance.recap.view' },
      { href: '/attendance/recap', label: 'Rekap Kehadiran', icon: 'table', action: 'attendance.recap.view' },
      { href: '/attendance/clarifications', label: 'Perlu Dijelaskan Tim', icon: 'shield', action: 'clarification.team.view' },
      { href: '/attendance/overtime', label: 'Lembur Tim', icon: 'table', action: 'overtime.team.view' },
      { href: '/attendance/missed-clock-in-habits', label: 'Kebiasaan Lupa Absen', icon: 'table', action: 'clarification.habit.view' },
      { href: '/attendance/handovers', label: 'Serah Terima Tim', icon: 'inbox', action: 'attendance.handover.view' },
      { href: '/attendance/problem-reports', label: 'Laporan Masalah', icon: 'shield', action: 'attendance.problem.read' },
    ],
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    items: [
      { href: '/settings/work-hours', label: 'Jam Kerja Cabang', icon: 'history', action: 'attendance.work_hours.view' },
      { href: '/settings/organization', label: 'Cabang & Jabatan', icon: 'building', action: 'org.manage' },
      { href: '/settings/access-rights', label: 'Hak Akses Jabatan', icon: 'shield', action: 'position.grants.update' },
      { href: '/settings/positions', label: 'Pengaturan Jabatan', icon: 'table', action: ['position_settings.propose', 'position_settings.approve'] },
      { href: '/settings/general', label: 'Pengaturan', icon: 'sliders', action: 'settings.view' },
      { href: '/settings/go-live-readiness', label: 'Siap Pindah', icon: 'list', action: 'migration.readiness_view' },
      { href: '/settings/request-types', label: 'Jenis Pengajuan', icon: 'list', action: 'request_types.view' },
      { href: '/settings/salary-components', label: 'Jenis Komponen Gaji', icon: 'list', action: ['salary.view', 'salary_components.manage'] },
      { href: '/settings/standard-pay', label: 'Gaji Standar', icon: 'sliders', action: ['salary.view', 'salary_standard.manage'] },
      { href: '/settings/deductions-overtime', label: 'Potongan & Lembur', icon: 'sliders', action: ['settings.view', 'settings.manage'] },
      { href: '/settings/loss-liabilities', label: 'Tanggungan Kehilangan', icon: 'sliders', action: ['inventory_loss.view', 'settings.manage'] },
      { href: '/settings/other-deduction-types', label: 'Jenis Potongan Lain', icon: 'list', action: ['other_deduction.view', 'other_deduction_types.manage'] },
      { href: '/settings/bonus-types', label: 'Jenis Bonus', icon: 'list', action: ['bonus.view', 'settings.manage'] },
      { href: '/settings/money-sources', label: 'Sumber Uang', icon: 'list', action: 'payment_sources.manage' },
      { href: '/settings/trip-rates', label: 'Tarif Ritase', icon: 'list', action: 'wage.rate.view' },
      { href: '/settings/wage-types', label: 'Jenis Upah', icon: 'list', action: 'wage.rate.view' },
      { href: '/settings/fine-types', label: 'Jenis Denda', icon: 'list', action: ['fine.view', 'fine.propose', 'fine_kind.manage'] },
      { href: '/bonuses/pairings', label: 'Pasangkan Groomer', icon: 'users', action: ['bonus.view', 'pos_groomer_link.manage'] },
    ],
  },
  {
    id: 'guide',
    label: 'Panduan',
    items: [{ href: '/guides/deduction-rules', label: 'Aturan Potongan', icon: 'list' }],
  },
  {
    id: 'system',
    label: 'Sistem',
    items: [
      { href: '/accounts', label: 'Akun & Tautan', icon: 'key', action: 'account.manage' },
      { href: '/login-history', label: 'Riwayat Masuk', icon: 'history', action: 'login_history.view_all' },
      { href: '/whats-new', label: 'Apa yang baru', icon: 'sparkle' },
    ],
  },
  {
    id: 'developer',
    label: 'Pengembang',
    items: [{ href: '/components', label: 'Komponen', icon: 'grid' }],
  },
];

/** Menu yang tetap ada di web Logistik selain kelompok Logistik (spec F2-7b §4). */
const LOGISTICS_WEB_MENU = ['/', '/my-trips', '/notifications'];

/**
 * Menu per web bila Logistik punya alamat sendiri (spec F2-7b §3): web Logistik hanya Beranda, Trip Saya,
 * Pemberitahuan, dan kelompok Logistik; HRIS tanpa kelompok Logistik dan Trip Saya. `split` false = tidak berubah.
 */
export function navForWeb(groups: NavGroup[], web: 'hris' | 'logistik', split: boolean): NavGroup[] {
  if (!split) return groups;
  return groups
    .map((group) => {
      const logistics = group.id === 'logistics';
      return {
        ...group,
        items: group.items.filter((item) => (web === 'logistik'
          ? logistics || LOGISTICS_WEB_MENU.includes(item.href)
          : !logistics && item.href !== '/my-trips')),
      };
    })
    .filter((group) => group.items.length > 0);
}

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
