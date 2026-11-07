import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { OtherDeductionForm, otherDeductionFormScreen, shortDeductionFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L17 Ajukan Potongan Lain (4 langkah). `?kurang-serah=TRUCK-12`: dari kurang serah Terima Uang (spec B3).
export default async function OtherDeductionFormPage({ searchParams }: { searchParams: Promise<{ 'kurang-serah'?: string }> }) {
  const actor = await requirePageAnyAction(['other_deduction.propose', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const match = /^(TRUCK|SELF)-(\d+)$/.exec((await searchParams)['kurang-serah'] ?? '');
  if (match) {
    const data = await shortDeductionFormScreen(actor, { source: match[1] as 'TRUCK' | 'SELF', paymentId: Number(match[2]) });
    if (!data) return <NoAccess />;
    return (
      <>
        <PageHeader title="Jadikan Potongan Lain" description="Kurang serah uang toko: orang dan nominal, jenis dan alasan, kali potong, lalu periksa." />
        <OtherDeductionForm {...data} />
      </>
    );
  }
  const data = await otherDeductionFormScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Ajukan Potongan Lain" description="Orang, jenis dan nominal, kali potong, lalu periksa." />
      <OtherDeductionForm {...data} />
    </>
  );
}
