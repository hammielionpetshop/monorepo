import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { getOrgLookup, NoAccess } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import { LossFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L13 Catat Kehilangan Barang (4 langkah). HR = usulan; Pemilik/GM langsung berlaku.
export default async function LossFormPage() {
  const actor = await requirePageAnyAction(['inventory_loss.record', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const org = await getOrgLookup();
  return (
    <>
      <PageHeader title="Catat Kehilangan Barang" description="Cabang, tanggal ditemukan, nilai, foto hasil opname, lalu periksa pembagiannya." />
      <LossFormScreen branches={org.branches.filter((b) => b.active).map(({ id, name }) => ({ id, name }))} today={todayWib()} direct={actor.fullAccess} />
    </>
  );
}
