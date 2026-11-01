import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { WorkRequestScreen, workRequestScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L29 Minta Masuk di Hari Libur.
export default async function WorkRequestPage({ searchParams }: { searchParams: Promise<{ branch?: string; pick?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.dayoff.request_work']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await workRequestScreen(actor, /^\d+$/.test(params.branch ?? '') ? Number(params.branch) : null);
  return (
    <>
      <PageHeader title="Minta Masuk di Hari Libur" description="Permintaan tercatat; orangnya menekan Siap masuk lalu memilih libur pengganti." />
      <WorkRequestScreen {...data} presetPick={/^\d+$/.test(params.pick ?? '') ? Number(params.pick) : null} />
    </>
  );
}
