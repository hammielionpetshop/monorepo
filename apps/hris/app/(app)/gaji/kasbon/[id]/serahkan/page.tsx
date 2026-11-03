import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { HandoverFlow, handoverFormScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// DRV-L29 Serahkan Uang Kasbon (3 langkah): Finance, Pemilik, GM.
export default async function AdvanceHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAnyAction(['advance.hand_over']);
  if (!actor) return <NoAccess />;
  const data = await handoverFormScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Serahkan Uang Kasbon" description="Yang diserahkan, dari mana dan kapan, lalu serahkan." />
      <HandoverFlow
        id={data.detail.id} number={data.detail.number} name={data.detail.name} amount={data.detail.decision?.amount ?? 0} installments={data.installments}
        approvedOn={data.approvedOn} today={data.today} sources={data.sources} people={data.people} self={data.self} weekly={data.weekly}
        canHandOver={data.detail.canHandOver} decidedBy={data.detail.decision?.by ?? '-'}
      />
    </>
  );
}
