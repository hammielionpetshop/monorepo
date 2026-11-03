import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ManageForm, manageFormScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// Terima Pelunasan Kasbon (spec L5 §3.10). Hak diperiksa ulang di server per kasbon.
export default async function RepayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAnyAction(['advance.repay']);
  if (!actor) return <NoAccess />;
  const data = await manageFormScreen(actor, Number(id));
  if (!data) notFound();
  const d = data.detail;
  return (
    <>
      <PageHeader title="Terima Pelunasan Kasbon" description="Uang tunai atau transfer dari orangnya, mengurangi sisa kasbon." />
      <ManageForm
        mode="repay" id={d.id} number={d.number} name={d.name} remaining={d.remaining} carried={data.carried} today={data.today} handedOn={data.handedOn}
        sources={data.sources} waiting={data.waiting} reschedule={data.reschedule} movement={null} allowed={d.canRepay}
      />
    </>
  );
}
