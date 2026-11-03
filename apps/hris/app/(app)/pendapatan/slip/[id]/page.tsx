import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MySlipScreen, mySlipScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L40 Slip Saya (spec L4g-1 §3.3). Slip orang lain = tidak ditemukan.
export default async function MySlipPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ versi?: string }> }) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const [{ id }, q] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(id) || (q.versi != null && !/^\d+$/.test(q.versi))) notFound();
  const data = await mySlipScreen(actor, Number(id), q.versi != null ? Number(q.versi) : null);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Slip gaji ${data.view.number ?? ''}`.trim()} description={`Periode ${data.view.period.label}`} />
      <MySlipScreen data={data} />
    </>
  );
}
