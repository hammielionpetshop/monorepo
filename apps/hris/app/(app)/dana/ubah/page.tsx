import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { FundChangeForm, fundChangeScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L26 Pindah dan Sesuaikan Dana (3 langkah, hanya Pemilik/GM).
export default async function FundChangePage({ searchParams }: { searchParams: Promise<{ jenis?: string; dana?: string }> }) {
  const actor = await requirePageAnyAction(['fund.manage']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await fundChangeScreen(actor);
  if (!data) return <NoAccess />;
  const kind = q.jenis === 'OPENING' || q.jenis === 'TRANSFER' ? q.jenis : 'ADJUSTMENT';
  return (
    <>
      <PageHeader title="Ubah Dana" description="Isi saldo awal, sesuaikan, atau pindahkan dana. Tidak bisa dihapus; salah isi dibetulkan dengan penyesuaian baru." />
      <FundChangeForm state={data.state} initialKind={kind} initialFund={q.dana === 'ABSENCE' ? 'ABSENCE' : 'DISCIPLINE'} />
    </>
  );
}
