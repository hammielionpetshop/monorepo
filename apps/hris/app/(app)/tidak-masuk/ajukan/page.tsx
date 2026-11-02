import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess } from '@/modules/access';
import { AbsenceFormScreen, absenceFormScreen } from '@/modules/attendance';
import { RequestFormFrame, resubmitSource } from '@/modules/requests';

export const dynamic = 'force-dynamic';

const KINDS = ['PERMIT', 'SICK', 'SICK_LETTER', 'ANNUAL_LEAVE', 'BEREAVEMENT'] as const;

// KEH-L30 Ajukan Izin, Sakit, atau Cuti (isian khas BER-L06). `?dari=<id>` = Ajukan ulang, `?jenis=` = jenis terpilih.
export default async function AbsenceFormPage({ searchParams }: { searchParams: Promise<{ dari?: string; jenis?: string }> }) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  if (!actor) return <NoAccess />;
  const { dari, jenis } = await searchParams;
  const data = await absenceFormScreen(actor, { employeeId: null, onBehalf: false });
  if (!data) return <NoAccess />;
  const source = dari && /^\d+$/.test(dari) ? await resubmitSource(actor, Number(dari), REQUEST_HANDLERS) : null;
  const presetKind = KINDS.find((kind) => kind === jenis) ?? null;
  return (
    <>
      <PageHeader title="Ajukan Izin, Sakit, atau Cuti" />
      <RequestFormFrame typeKey="absence" resubmitOf={source?.fromId}>
        {data.allowed
          ? <AbsenceFormScreen {...data} prefill={source?.values ?? null} resubmittedFromId={source?.fromId ?? null} presetKind={presetKind} />
          : <p className="text-sm text-ink-muted">{data.problem}</p>}
      </RequestFormFrame>
    </>
  );
}
