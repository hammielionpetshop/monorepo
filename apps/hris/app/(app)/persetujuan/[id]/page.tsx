import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { OBJECTION_TYPE_KEYS, ObjectionDecisionPanel, objectionDecisionPanel } from '@/modules/payroll';
import { RequestDetailScreen, deciderActions, getRequestDetail, nextWaitingId } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L21 Putuskan pengajuan. Keberatan slip membawa isi khas: slip, baris yang ditandai, jalan pembetulan (GAJ-L42).
export default async function DecidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAnyAction(deciderActions());
  if (!actor) return <NoAccess />;
  const detail = await getRequestDetail(actor, Number(id), REQUEST_HANDLERS);
  if (!detail) notFound();
  const nextId = await nextWaitingId(actor, Number(id));
  const objection = (OBJECTION_TYPE_KEYS as readonly string[]).includes(detail.card.typeKey) ? await objectionDecisionPanel(actor, Number(id)) : null;
  return (
    <>
      <PageHeader title="Putuskan pengajuan" />
      <div className="space-y-4">
        {objection && <ObjectionDecisionPanel data={objection} requestId={Number(id)} />}
        <RequestDetailScreen detail={detail} mode="decide" nextId={nextId} resubmitHref={null} />
      </div>
    </>
  );
}
