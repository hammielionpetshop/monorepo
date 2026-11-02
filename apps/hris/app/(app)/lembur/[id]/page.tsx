import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { OvertimeClaimForm, claimFormScreen } from '@/modules/attendance';
import { RequestFormFrame, resubmitSource } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// Langkah klaim KEH-L41. `?dari=<id>` = Ajukan ulang.
export default async function OvertimeClaimPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dari?: string }> }) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  if (!actor) return <NoAccess />;
  const { id } = await params;
  const query = await searchParams;
  if (!/^\d+$/.test(id)) return <NoAccess />;
  const data = await claimFormScreen(actor, Number(id));
  if (!data) return <NoAccess />;
  const source = query.dari && /^\d+$/.test(query.dari) ? await resubmitSource(actor, Number(query.dari), REQUEST_HANDLERS) : null;
  return (
    <>
      <PageHeader title="Klaim Lembur" />
      <RequestFormFrame typeKey="overtime_claim" resubmitOf={source?.fromId}>
        {data.allowed
          ? <OvertimeClaimForm day={data.day} orderers={data.orderers} resubmit={source?.values ?? null} resubmittedFromId={source?.fromId ?? null} />
          : <p className="text-sm text-ink-muted">{data.problem}</p>}
      </RequestFormFrame>
    </>
  );
}
