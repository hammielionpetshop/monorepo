import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { AdvanceDecisionPanel, decisionPanel } from '@/modules/advances';
import { OBJECTION_TYPE_KEYS, ObjectionDecisionPanel, nextSlipEstimate, objectionDecisionPanel } from '@/modules/payroll';
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
  // Kasbon (DRV-L27): periksa / putuskan dengan angka akhir; perkiraan bersih slip berikutnya hanya untuk Pemilik/GM.
  const advance = detail.card.typeKey === 'advance' ? await decisionPanel(actor, Number(id)) : null;
  const estimateNet = advance?.role === 'APPROVER' ? await nextSlipEstimate(advance.employeeId) : null;
  return (
    <>
      <PageHeader title="Putuskan pengajuan" />
      <div className="space-y-4">
        {objection && <ObjectionDecisionPanel data={objection} requestId={Number(id)} />}
        {advance && <AdvanceDecisionPanel data={{ ...advance, estimateNet }} />}
        <RequestDetailScreen detail={detail} mode="decide" nextId={nextId} resubmitHref={null} />
      </div>
    </>
  );
}
