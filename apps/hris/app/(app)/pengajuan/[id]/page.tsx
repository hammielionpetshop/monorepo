import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { REQUEST_HANDLERS } from '@/lib/request-handlers';
import { RequestDetailScreen, getRequestDetail } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L07 Rincian pengajuan saya. Pengajuan yang tidak boleh dilihat = tidak ditemukan.
export default async function MyRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const detail = await getRequestDetail(actor, Number(id), REQUEST_HANDLERS);
  if (!detail) notFound();
  return (
    <>
      <PageHeader title="Rincian pengajuan" />
      <RequestDetailScreen
        detail={detail}
        mode="mine"
        nextId={null}
        resubmitHref={detail.canResubmit ? `/pengajuan/baru/${detail.card.typeKey}?dari=${detail.card.id}` : null}
      />
    </>
  );
}
