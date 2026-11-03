import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { BonusTabScreen, bonusTabScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L27 Bonus Seseorang (spec L4d §4). Orang yang tidak boleh dilihat = tidak ditemukan.
export default async function BonusTabPage({ params, searchParams }: {
  params: Promise<{ employeeId: string }>; searchParams: Promise<{ periode?: string }>;
}) {
  const actor = await requirePageAnyAction(['bonus.view']);
  if (!actor) return <NoAccess />;
  const { employeeId } = await params;
  if (!/^\d+$/.test(employeeId)) notFound();
  const { periode } = await searchParams;
  const data = await bonusTabScreen(actor, Number(employeeId), periode ?? null);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Bonus ${data.person.name}`} description="Baris bonus per jenis dan jumlah yang masuk slip periode ini." actions={<NewBadge feature="fitur/tab-bonus" />} />
      <BonusTabScreen {...data} />
    </>
  );
}
