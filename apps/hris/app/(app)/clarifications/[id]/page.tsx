import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { ExplainFormScreen, explainFormScreen } from '@/modules/attendance';
import { RequestFormFrame, resubmitSource } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// KEH-L36 Isi Penjelasan. `?seri=1` = rangkaian alpha berturut-turut, `?dari=<id>` = Ajukan ulang, `?terlambat=1` = pengajuan terlambat.
export default async function ExplainPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ seri?: string; dari?: string; terlambat?: string }>;
}) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  if (!actor) return <NoAccess />;
  const { id } = await params;
  const query = await searchParams;
  if (!/^\d+$/.test(id)) return <NoAccess />;
  const data = await explainFormScreen(actor, Number(id), { series: query.seri === '1', late: query.terlambat === '1' });
  if (!data) return <NoAccess />;
  const source = query.dari && /^\d+$/.test(query.dari) ? await resubmitSource(actor, Number(query.dari), REQUEST_HANDLERS) : null;
  return (
    <>
      <PageHeader title={data.allowed && data.event.late ? 'Ajukan Terlambat' : 'Isi Penjelasan'} />
      <RequestFormFrame typeKey="clarification" resubmitOf={source?.fromId}>
        {data.allowed
          ? <ExplainFormScreen {...data} resubmit={source?.values ?? null} resubmittedFromId={source?.fromId ?? null} />
          : <p className="text-sm text-ink-muted">{data.problem}</p>}
      </RequestFormFrame>
    </>
  );
}
