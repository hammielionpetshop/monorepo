import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TotalsScreen, totalsScreen, type TotalsFilter } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L43 Total Diterima per Orang (spec L4g §3.8): Pemilik/GM semua, HR tanpa jabatan bertanda.
export default async function TotalsPage({ searchParams }: { searchParams: Promise<TotalsFilter> }) {
  const actor = await requirePageAnyAction(['payroll_totals.view']);
  if (!actor) return <NoAccess />;
  const data = await totalsScreen(actor, await searchParams);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Total Diterima per Orang" description="Berapa yang sudah diterima dan yang belum dibayar, per orang, untuk 1–12 periode." />
      <TotalsScreen data={data} />
    </>
  );
}
