import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TotalsPersonScreen, totalsPersonScreen, type TotalsFilter } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Rincian Total Diterima satu orang per periode (spec L4g §3.8), hanya baca.
export default async function TotalsPersonPage({ params, searchParams }: { params: Promise<{ employeeId: string }>; searchParams: Promise<TotalsFilter> }) {
  const actor = await requirePageAnyAction(['payroll_totals.view']);
  if (!actor) return <NoAccess />;
  const [{ employeeId }, q] = await Promise.all([params, searchParams]);
  const data = await totalsPersonScreen(actor, Number(employeeId), q);
  if (!data) notFound();
  const back = new URLSearchParams(Object.entries(q).filter(([, v]) => typeof v === 'string' && v) as [string, string][]).toString();
  return (
    <>
      <PageHeader
        title={`Total Diterima: ${data.person.name}`}
        actions={<Link className="text-sm underline" href={`/gaji/total-diterima${back ? `?${back}` : ''}`}>Kembali ke daftar</Link>}
      />
      <TotalsPersonScreen data={data} />
    </>
  );
}
