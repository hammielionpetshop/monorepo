import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReturnPickupsScreen, returnPickupsScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Jemput Retur (A2, spec docs/work/specs/2026-11-08-jemput-retur-design.md): pembuat tugas, Kepala Gudang, pelihat trip.
export default async function ReturnPickupsPage() {
  const { actor } = await getRequestActor();
  const data = await returnPickupsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Jemput Retur"
        description="Tugas mengambil retur di toko: dibuat kantor, dimasukkan ke trip, dikerjakan driver. Barang yang diambil masuk Barang Kembali; nilainya lewat Retur di BO."
        actions={<NewBadge feature="/logistik/jemput-retur" />}
      />
      <ReturnPickupsScreen {...data} />
    </>
  );
}
