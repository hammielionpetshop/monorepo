import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ApprovalsScreen, deciderActions, listApprovals } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L20 Persetujuan: satu kotak untuk semua jenis pengajuan yang menunggu keputusan orang itu.
export default async function ApprovalsPage({ searchParams }: {
  searchParams: Promise<{ tab?: string; type?: string; branch?: string; q?: string }>;
}) {
  const actor = await requirePageAnyAction(deciderActions());
  if (!actor) return <NoAccess />;
  const data = await listApprovals(actor, await searchParams);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Persetujuan" description="Pengajuan yang menunggu keputusan Anda. Putuskan satu per satu." />
      <ApprovalsScreen data={data} />
    </>
  );
}
