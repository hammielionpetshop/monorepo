import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyRequestsScreen, listMyRequests } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L04 Pengajuan Saya: satu pintu semua jenis pengajuan.
export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const data = await listMyRequests(actor, await searchParams);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Pengajuan Saya" description="Semua pengajuan Anda dan statusnya." />
      <MyRequestsScreen data={data} />
    </>
  );
}
