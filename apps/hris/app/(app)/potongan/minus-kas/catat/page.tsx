import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { getOrgLookup, NoAccess } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import { ManualShortageForm } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Catat Minus Kas di luar shift POS (GAJ-79). HR/Finance = usulan; Pemilik/GM langsung berlaku.
export default async function ManualShortagePage() {
  const actor = await requirePageAnyAction(['cash_shortage.record', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const org = await getOrgLookup();
  return (
    <>
      <PageHeader title="Catat Minus Kas" description="Hanya untuk kejadian di luar shift POS. Bernama atau tanpa nama." />
      <ManualShortageForm branches={org.branches.filter((b) => b.active).map(({ id, name }) => ({ id, name }))} today={todayWib()} direct={actor.fullAccess} />
    </>
  );
}
