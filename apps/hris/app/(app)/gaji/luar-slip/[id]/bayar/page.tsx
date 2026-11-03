import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { OffSlipPayFlow, offSlipPayScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L37 Bayar di Luar Slip (spec L4f §3.7): dipotongkan ke Piutang Lain lebih dulu, sisanya dengan uang.
export default async function OffSlipPayPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip.pay']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await offSlipPayScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Bayar di luar slip" description="Bonus susulan atau koreksi plus untuk orang yang slip terakhirnya sudah Dibayar." />
      <OffSlipPayFlow {...data} />
    </>
  );
}
