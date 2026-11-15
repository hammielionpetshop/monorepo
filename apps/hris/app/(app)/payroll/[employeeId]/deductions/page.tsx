import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DeductionsTabScreen, deductionsTabScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L19 Potongan dan Sisa (spec L4c §3.7). Orang yang tidak boleh dilihat = tidak ditemukan.
export default async function DeductionsTabPage({ params, searchParams }: {
  params: Promise<{ employeeId: string }>; searchParams: Promise<{ periode?: string }>;
}) {
  const actor = await requirePageAnyAction(['salary.view', 'salary.change']);
  if (!actor) return <NoAccess />;
  const { employeeId } = await params;
  if (!/^\d+$/.test(employeeId)) notFound();
  const { periode } = await searchParams;
  const data = await deductionsTabScreen(actor, Number(employeeId), periode ?? null);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Potongan ${data.person.name}`} description="Urutan pengambilan potongan dan sisa yang dibawa ke slip berikutnya." actions={<NewBadge feature="fitur/tab-potongan" />} />
      <DeductionsTabScreen {...data} />
    </>
  );
}
