import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { UnloadingForm, unloadingFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// DRV-L12 Laporan Bongkaran Baru (5 langkah, HP & PC; spec L8 §3.2).
export default async function UnloadingNewPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const actor = await requirePageAnyAction(['unloading.create']);
  if (!actor) return <NoAccess />;
  const data = await unloadingFormScreen(actor, (await searchParams).tanggal ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Laporan Bongkaran Baru" description="Apa yang datang dan siapa yang membongkar. Berat, upah, dan bagian tiap orang dihitung sistem." />
      <UnloadingForm key={data.workDate} {...data} />
    </>
  );
}
