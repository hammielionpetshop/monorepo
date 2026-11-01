import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { NoAccess, can } from '@/modules/access';
import { IdentityChangeForm, ownIdentityValues } from '@/modules/employees';
import {
  REQUEST_TYPES, RequestFormFrame, isRequestTypeKey, openRequestFor, requestNumber, resubmitSource,
} from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L06 Isian pengajuan: kerangka Mesin Pengajuan + isi khas modul jenisnya. `?dari=<id>` = Ajukan ulang.
export default async function RequestFormPage({ params, searchParams }: {
  params: Promise<{ type: string }>; searchParams: Promise<{ dari?: string }>;
}) {
  const { type } = await params;
  const { dari } = await searchParams;
  if (!isRequestTypeKey(type)) notFound();
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  if (!actor || !can(actor, REQUEST_TYPES[type].requestAction, { personId: actor.personId })) return <NoAccess />;

  const open = await openRequestFor(actor.personId, type);
  const source = dari && /^\d+$/.test(dari) ? await resubmitSource(actor, Number(dari), REQUEST_HANDLERS) : null;
  const current = await ownIdentityValues(actor);
  if (!current) return <NoAccess />;
  return (
    <>
      <PageHeader title="Ajukan" />
      <RequestFormFrame typeKey={type} resubmitOf={source?.fromId}>
        {open ? (
          <Alert tone="warn" title="Masih ada pengajuan yang menunggu">
            <Link className="text-brand-700" href={`/pengajuan/${open}`}>{requestNumber(open)}</Link> belum diputuskan.
            Tunggu keputusannya atau batalkan dulu.
          </Alert>
        ) : (
          <IdentityChangeForm current={current} prefill={source?.values} resubmittedFromId={source?.fromId ?? null} />
        )}
      </RequestFormFrame>
    </>
  );
}
