import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyHandoversScreen, myHandoversScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L21 Serah Terima Saya: yang diterima dan yang dikirim, siapa sudah membaca, Tambah keterangan.
export default async function MyHandoversPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const { tab } = await searchParams;
  const data = await myHandoversScreen(actor, tab === 'dikirim' ? 'sent' : 'received');
  return (
    <>
      <PageHeader title="Serah Terima Saya" description="Serah terima dari Laporan Pulang. Isi yang terkirim tidak bisa diubah." />
      <MyHandoversScreen {...data} />
    </>
  );
}
