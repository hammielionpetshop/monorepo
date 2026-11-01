import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ChooseTypeScreen, getChooseScreen } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L05 Ajukan: pilih jenis.
export default async function ChooseTypePage() {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const types = await getChooseScreen(actor);
  if (!types) return <NoAccess />;
  return (
    <>
      <PageHeader title="Ajukan" description="Pilih jenis pengajuan." />
      <ChooseTypeScreen types={types} />
    </>
  );
}
