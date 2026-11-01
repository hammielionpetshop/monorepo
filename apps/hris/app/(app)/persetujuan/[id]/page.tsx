import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { RequestDetailScreen, deciderActions, getRequestDetail, nextWaitingId } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L21 Putuskan pengajuan.
export default async function DecidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAnyAction(deciderActions());
  if (!actor) return <NoAccess />;
  const detail = await getRequestDetail(actor, Number(id), REQUEST_HANDLERS);
  if (!detail) notFound();
  const nextId = await nextWaitingId(actor, Number(id));
  return (
    <>
      <PageHeader title="Putuskan pengajuan" />
      <RequestDetailScreen detail={detail} mode="decide" nextId={nextId} resubmitHref={null} />
    </>
  );
}
