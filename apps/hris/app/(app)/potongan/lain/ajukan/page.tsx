import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { OtherDeductionForm, otherDeductionFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L17 Ajukan Potongan Lain (4 langkah).
export default async function OtherDeductionFormPage() {
  const actor = await requirePageAnyAction(['other_deduction.propose', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const data = await otherDeductionFormScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Ajukan Potongan Lain" description="Orang, jenis dan nominal, kali potong, lalu periksa." />
      <OtherDeductionForm {...data} />
    </>
  );
}
