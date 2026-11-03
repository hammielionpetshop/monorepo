import { hasAction, type Actor } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { cutoverOn, legacyApprovedCount } from '@/modules/advances';
import { locationScreen } from '@/modules/attendance';
import { listPeopleForModules, todayWib } from '@/modules/employees';
import { readFundState, salaryListScreen } from '@/modules/payroll';
import { settingOn } from '@/modules/settings';

/**
 * Siap Pindah (spec L9 §3.4): daftar periksa sebelum hari pindah, dibaca dari data (bukan dicentang tangan).
 * Dirangkai di app/ lewat pintu tiap modul, seperti `request-handlers.ts`. Tiap butir punya tautan ke layar perbaikannya.
 */
export type ReadinessItem = { key: string; title: string; ok: boolean; detail: string; names: string[]; href: string };

export async function readinessScreen(actor: Actor | null): Promise<{ cutover: string | null; items: ReadinessItem[] } | null> {
  if (!actor?.fullAccess || !hasAction(actor, 'migration.readiness_view')) return null;
  const today = todayWib();
  const cutover = await cutoverOn(today);
  const people = (await listPeopleForModules()).filter((p) => p.activeToday);
  const [accounts, salary, location, funds, legacy] = await Promise.all([
    activeHrisAccounts(people.map((p) => p.id)),
    salaryListScreen(actor),
    locationScreen(actor, today),
    readFundState(),
    legacyApprovedCount(),
  ]);
  const basisDate = cutover ?? today;
  const noBasis: string[] = [];
  for (const p of people) {
    const basis = await settingOn<string>('position.pay_basis', basisDate, { positionId: p.positionId });
    if (basis !== 'MONTHLY' && basis !== 'WEEKLY') noBasis.push(`${p.name} (${p.positionName})`);
  }
  const noAccount = people.filter((p) => !accounts.has(p.id)).map((p) => p.name);
  const noSalary = salary.rows.filter((r) => r.missing).map((r) => r.name);
  const noPoint = location.branches.filter((b) => b.latitude == null || b.longitude == null).map((b) => b.name);
  const noQr = location.branches.filter((b) => !b.qr).map((b) => b.name);
  const noFund = [!funds.discipline.hasEntries && 'Dana Disiplin', !funds.absence.hasEntries && 'Dana Tidak Hadir'].filter(Boolean) as string[];
  const item = (key: string, title: string, names: string[], href: string, okText: string, badText: (n: number) => string): ReadinessItem => ({
    key, title, ok: names.length === 0, detail: names.length ? badText(names.length) : okText, names, href,
  });
  const items: ReadinessItem[] = [
    {
      key: 'cutover', title: 'Hari pindah ditetapkan', ok: Boolean(cutover), names: [], href: '/pengaturan/umum',
      detail: cutover ? `Hari pindah ${cutover.split('-').reverse().join('-')} (SIS-13).` : 'Isi di Pengaturan › Pindah sistem.',
    },
    item('account', 'Karyawan aktif punya akun HRIS', noAccount, '/karyawan', 'Semua karyawan aktif punya akun.', (n) => `${n} orang belum punya akun.`),
    item('basis', 'Jabatan punya dasar gaji (slip utama)', noBasis, '/pengaturan/jabatan', 'Semua jabatan punya dasar gaji.', (n) => `${n} orang jabatannya belum punya dasar gaji (DRV-04).`),
    item('salary', 'Karyawan punya gaji', noSalary, '/gaji?flag=missing', 'Semua karyawan yang Anda lihat punya gaji.', (n) => `${n} orang belum punya gaji.`),
    item('point', 'Cabang punya titik lokasi', noPoint, '/kehadiran/qr', 'Semua cabang punya titik lokasi.', (n) => `${n} cabang belum punya titik lokasi.`),
    item('qr', 'Cabang punya QR absen', noQr, '/kehadiran/qr', 'Semua cabang punya QR.', (n) => `${n} cabang belum punya QR.`),
    item('fund', 'Saldo awal Dana Disiplin & Dana Tidak Hadir', noFund, '/dana', 'Kedua dana sudah punya saldo awal.', (n) => `${n} dana belum diisi saldo awal (SIS-33).`),
    {
      key: 'legacy', title: 'Sisa kasbon bawaan disahkan', ok: legacy.open === 0, names: [], href: '/gaji/kasbon/bawaan',
      detail: legacy.open ? `${legacy.open} sisa kasbon bawaan menunggu disahkan.` : `${legacy.approved} sisa kasbon bawaan sudah disahkan; tidak ada yang menunggu.`,
    },
  ];
  return { cutover, items };
}
