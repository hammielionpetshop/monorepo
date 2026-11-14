import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LogoutButton } from '@/components/logout-button';
import { HoldSecondsProvider } from '@/components/ui/hold-button';
import { NewFeaturesProvider } from '@/components/ui/new-badge';
import { Alert, EmptyState } from '@/components/ui/surface';
import { getRequestActor, stagingRestricted } from '@/lib/authz';
import { NAV_GROUPS, navForWeb, visibleNav } from '@/lib/nav';
import { NEW_FEATURES, activeNewFeatures } from '@/lib/new-features';
import { LIMITED_BANNER, hasAction } from '@/modules/access';
import { hasMyPay } from '@/modules/payroll';
import { openClarificationCount, openOvertimeCount, overtimeMenuVisible, tracksAttendance } from '@/modules/attendance';
import { myTripMenuVisible } from '@/modules/logistics';
import { unreadCount } from '@/modules/notifications';
import { waitingSummary } from '@/modules/requests';
import { shellSettingsToday } from '@/modules/settings';
import { webSwitchUrl } from '@/lib/web-switch';
import { redirectTarget, webForHost, webOriginsFromEnv } from '@/lib/web-split';
import { logisticsWebAllowed } from '@/lib/web-split-server';

export const dynamic = 'force-dynamic';

/** Menu mantan karyawan dalam akses terbatas (spec L4g §3.7). */
const LIMITED_MENU = ['/pendapatan', '/pengajuan', '/pemberitahuan', '/profil'];

/**
 * Kerangka akses terbatas mantan karyawan: menu terbatas dan bilah peringatan. Penolakan alamat lain ada di
 * `template.tsx` (dirender ulang tiap pindah halaman) dan di `can()`.
 */
async function LimitedShell({ accountId, children }: { accountId: number; children: React.ReactNode }) {
  const [shell, unread] = await Promise.all([shellSettingsToday(), unreadCount(accountId)]);
  const groups = NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => LIMITED_MENU.includes(item.href)).map(({ action: _a, ...item }) => item) }))
    .filter((group) => group.items.length > 0);
  return (
    <HoldSecondsProvider seconds={shell.holdSeconds}>
      <NewFeaturesProvider keys={activeNewFeatures(NEW_FEATURES, shell.today, shell.newBadgeDays)}>
        <AppShell groups={groups} counts={{ notifications: unread }}>
          <div className="mb-4"><Alert tone="warn">{LIMITED_BANNER}</Alert></div>
          {children}
        </AppShell>
      </NewFeaturesProvider>
    </HoldSecondsProvider>
  );
}

// Semua halaman masuk melewati sini: sesi pusat + tautan HRIS diperiksa satu kali.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Web Logistik di alamat sendiri (spec F2-7b §3): layar yang dibuka di web yang salah dipindah ke web pemiliknya.
  const head = await headers();
  const origins = webOriginsFromEnv();
  const web = webForHost(head.get('host'), origins);
  const target = redirectTarget(web, head.get('x-hris-path') ?? '/', head.get('x-hris-search') ?? '', origins);
  if (target) redirect(target);
  const { session, actor } = await getRequestActor();
  if (!session.ok) {
    // Sesi sah tetapi tanpa tautan HRIS: jangan memantul ke login.
    if (session.code === 'APP_ACCESS_DENIED' || session.code === 'ACCESS_EXPIRED') {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-sm">
            <EmptyState title="Akses HRIS belum tersedia" action={<LogoutButton />}>
              Akun ini belum memiliki tautan akses HRIS. Hubungi Owner atau GM.
            </EmptyState>
          </div>
        </main>
      );
    }
    const back = (await headers()).get('x-hris-return');
    redirect(back ? `/login?next=${encodeURIComponent(back)}` : '/login');
  }
  // Kunci uji banding (spec L9 §4, SIS-41): selain Pemilik/GM hanya melihat pesan ini.
  if (stagingRestricted() && !actor?.fullAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm">
          <EmptyState title="HRIS staging sedang dikunci" action={<LogoutButton />}>
            Sedang ada uji banding dengan data salinan sistem lama. Untuk sementara hanya Pemilik dan GM yang bisa masuk.
          </EmptyState>
        </div>
      </main>
    );
  }
  if (actor?.limited) {
    if (web === 'logistik' && origins.hris) redirect(origins.hris);
    return <LimitedShell accountId={session.accountId}>{children}</LimitedShell>;
  }
  const shell = await shellSettingsToday();
  const split = !!origins.logistics;
  const logisticsWeb = split ? await logisticsWebAllowed(actor, shell.today) : false;
  if (web === 'logistik' && !logisticsWeb) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm">
          <EmptyState title="Akses Logistik belum tersedia" action={origins.hris ? <a href={origins.hris} className="text-brand-700">Buka HRIS</a> : <LogoutButton />}>
            Jabatan Anda belum punya hak Logistik. Hubungi Owner atau GM.
          </EmptyState>
        </div>
      </main>
    );
  }
  const [unread, waiting, switchUrl] = await Promise.all([
    unreadCount(session.accountId), waitingSummary(actor), webSwitchUrl(session.accountId, web, web === 'hris' && logisticsWeb),
  ]);
  const checksIn = actor ? await tracksAttendance(actor, shell.today) : false;
  const clarify = checksIn ? await openClarificationCount(actor) : 0;
  const overtimeMenu = checksIn ? await overtimeMenuVisible(actor, shell.today) : false;
  const overtime = overtimeMenu ? await openOvertimeCount(actor) : 0;
  // Pendapatan Saya hanya untuk orang yang punya slip (spec L4g §9 butir 3).
  const myPay = await hasMyPay(actor);
  const tripMenu = await myTripMenuVisible(actor, shell.today);
  const groups = navForWeb(visibleNav((action) => (action === 'attendance.self.check' ? checksIn : hasAction(actor, action)))
    .map((group) => ({ ...group, items: group.items.filter((item) => (item.href !== '/lembur' || overtimeMenu) && (item.href !== '/pendapatan' || myPay) && (item.href !== '/trip-saya' || tripMenu)) })), web, split);
  return (
    <HoldSecondsProvider seconds={shell.holdSeconds}>
      <NewFeaturesProvider keys={activeNewFeatures(NEW_FEATURES, shell.today, shell.newBadgeDays)}>
        <AppShell groups={groups} counts={{ notifications: unread, approvals: waiting.count, clarifications: clarify, overtime }} switchUrl={switchUrl} title={web === 'logistik' ? 'Logistik' : 'HRIS'}>{children}</AppShell>
      </NewFeaturesProvider>
    </HoldSecondsProvider>
  );
}
