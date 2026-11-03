import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ManageForm, manageFormScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// Ubah Jadwal Cicilan (spec L5 §3.10). Hak diperiksa ulang di server per kasbon.
export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAnyAction(['advance.manage']);
  if (!actor) return <NoAccess />;
  const data = await manageFormScreen(actor, Number(id));
  if (!data) notFound();
  const d = data.detail;
  return (
    <>
      <PageHeader title="Ubah Jadwal Cicilan" description="Banyaknya cicilan dan gajian mulai; jumlahnya tetap." />
      <ManageForm
        mode="reschedule" id={d.id} number={d.number} name={d.name} remaining={d.remaining} carried={data.carried} today={data.today} handedOn={data.handedOn}
        sources={data.sources} waiting={data.waiting} reschedule={data.reschedule} movement={null} allowed={d.canManage}
      />
    </>
  );
}
