import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { BranchDaysOffScreen, absenceCalendar, branchDaysOffScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const TABS = ['calendar', 'missing', 'swaps', 'absent'] as const;

// KEH-L27 Libur Cabang.
export default async function BranchDaysOffPage({ searchParams }: { searchParams: Promise<{ branch?: string; period?: string; tab?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.dayoff.view']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await branchDaysOffScreen(actor, {
    branchId: /^\d+$/.test(params.branch ?? '') ? Number(params.branch) : null, periodStart: params.period ?? null,
  });
  const tab = TABS.find((key) => key === params.tab) ?? 'calendar';
  // Tab Tidak masuk (L3f): tanggal, nama, status; jenis hanya untuk HR, Pemilik, GM (KEH-80, 149).
  const absent = tab === 'absent' && data.branchId ? await absenceCalendar(actor, data.branchId, data.periodStart) : [];
  return (
    <>
      <PageHeader title="Libur Cabang" description="Siapa libur kapan, yang belum memilih, dan tukar yang terjadi." />
      <BranchDaysOffScreen {...data} tab={tab} absent={absent} />
    </>
  );
}
