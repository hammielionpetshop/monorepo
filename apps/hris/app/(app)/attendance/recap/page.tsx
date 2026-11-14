import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { RecapScreen, recapScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const num = (value?: string) => (/^\d+$/.test(value ?? '') ? Number(value) : null);

// KEH-L16 Rekap Kehadiran.
export default async function RecapPage({ searchParams }: { searchParams: Promise<{ period?: string; branch?: string; employee?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.recap.view']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await recapScreen(actor, { period: params.period ?? null, branchId: num(params.branch), employeeId: num(params.employee) });
  return (
    <>
      <PageHeader title="Rekap Kehadiran" description="Periode 26 sampai 25, sama dengan slip. Angkanya sama dengan yang dilihat karyawan." />
      <RecapScreen {...data} />
    </>
  );
}
