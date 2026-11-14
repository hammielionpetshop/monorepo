import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess, hasAction } from '@/modules/access';
import { CorrectionScreen, correctionHistoryScreen, correctionScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const num = (value?: string) => (/^\d+$/.test(value ?? '') ? Number(value) : null);

// KEH-L13 Koreksi Absen: satu-satunya pintu membetulkan absen (KEH-28).
export default async function CorrectionPage({ searchParams }: {
  searchParams: Promise<{ tab?: string; mode?: string; employee?: string; branch?: string; date?: string; period?: string; q?: string }>;
}) {
  const actor = await requirePageAnyAction(['attendance.correction.create', 'attendance.correction.view']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const canCreate = hasAction(actor, 'attendance.correction.create');
  const canView = hasAction(actor, 'attendance.correction.view');
  const tab = params.tab === 'history' || !canCreate ? 'history' : 'fix';
  const fix = canCreate && tab === 'fix' ? await correctionScreen(actor, {
    mode: params.mode === 'many' ? 'many' : 'one', employeeId: num(params.employee), branchId: num(params.branch), date: params.date ?? null,
  }) : null;
  const history = canView && tab === 'history'
    ? await correctionHistoryScreen(actor, { branchId: num(params.branch), period: params.period ?? null, q: params.q ?? '' }) : null;
  return (
    <>
      <PageHeader title="Koreksi Absen" description="Catatan asli tidak ditimpa. Telat dihitung ulang sistem. Tidak ada yang mengoreksi absennya sendiri." />
      <CorrectionScreen tab={tab} canCreate={canCreate} fix={fix} history={history} />
    </>
  );
}
